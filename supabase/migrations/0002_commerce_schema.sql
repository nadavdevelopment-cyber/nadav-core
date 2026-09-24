-- NADAV Commerce 0.1 — reusable apparel and retail primitives.
-- Depends on 0001_core_schema.sql. This is deliberately separate from Food catalog tables.
begin;

create table public.core_commerce_members (
  restaurant_id uuid not null references public.core_restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','editor')),
  created_at timestamptz not null default now(),
  primary key (restaurant_id,user_id)
);

create table public.core_commerce_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.core_restaurants(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  name text not null check (length(trim(name)) between 1 and 100),
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id,slug),
  unique (restaurant_id,id)
);

create table public.core_commerce_products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.core_restaurants(id) on delete cascade,
  category_id uuid not null,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  name text not null check (length(trim(name)) between 1 and 160),
  description text not null default '' check (length(description)<=2000),
  price bigint not null check (price > 0 and price <= 1000000000),
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images)='array' and jsonb_array_length(images)<=8),
  composition text not null default '' check (length(composition)<=1000),
  care text not null default '' check (length(care)<=1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id,slug),
  unique (restaurant_id,id),
  constraint core_commerce_products_category_tenant_fk foreign key (restaurant_id,category_id) references public.core_commerce_categories(restaurant_id,id) on delete restrict
);
create index core_commerce_products_catalog on public.core_commerce_products(restaurant_id,category_id,active);

create table public.core_commerce_variants (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.core_restaurants(id) on delete cascade,
  product_id uuid not null,
  sku text,
  color text not null check (length(trim(color)) between 1 and 80),
  color_value text,
  size text not null check (length(trim(size)) between 1 and 40),
  stock integer check (stock is null or (stock >= 0 and stock <= 1000000)),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id,color,size),
  constraint core_commerce_variants_product_tenant_fk foreign key (restaurant_id,product_id) references public.core_commerce_products(restaurant_id,id) on delete cascade
);
create index core_commerce_variants_product on public.core_commerce_variants(restaurant_id,product_id,active);

create table public.core_commerce_content (
  restaurant_id uuid primary key references public.core_restaurants(id) on delete cascade,
  content jsonb not null default '{}'::jsonb check (jsonb_typeof(content)='object'),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings)='object'),
  updated_at timestamptz not null default now()
);

create table public.core_commerce_customers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.core_restaurants(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  email citext not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id,email)
);

create table public.core_commerce_orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.core_restaurants(id) on delete cascade,
  number bigint not null,
  idempotency_key uuid not null,
  customer_id uuid references public.core_commerce_customers(id) on delete set null,
  status text not null check (status in ('new','confirmed','packing','shipped','delivered','cancelled')),
  payment_status text not null check (payment_status in ('pending','approved','rejected','refunded')),
  total bigint not null check (total>=0),
  data jsonb not null check (jsonb_typeof(data)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id,idempotency_key),
  unique (restaurant_id,number)
);
create index core_commerce_orders_restaurant_date on public.core_commerce_orders(restaurant_id,created_at desc);

do $$ declare table_name text; begin
  foreach table_name in array array['core_commerce_members','core_commerce_categories','core_commerce_products','core_commerce_variants','core_commerce_content','core_commerce_customers','core_commerce_orders'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on public.%I from anon, authenticated',table_name);
  end loop;
end $$;

create function public.core_commerce_place_order(p_restaurant uuid,p_key uuid,p_input jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare existing jsonb; item jsonb; product_row record; variant_row record; line jsonb; lines jsonb:='[]'::jsonb; next_number bigint; subtotal bigint:=0; delivery_fee bigint:=0; total bigint; order_data jsonb; customer_row uuid; commerce_settings jsonb; quantity integer;
begin
  select data into existing from public.core_commerce_orders where restaurant_id=p_restaurant and idempotency_key=p_key;
  if existing is not null then return jsonb_build_object('order',existing,'created',false); end if;
  if jsonb_typeof(p_input)<>'object' or jsonb_typeof(p_input->'items')<>'array' or jsonb_array_length(p_input->'items') not between 1 and 40 then raise exception 'INVALID_ORDER'; end if;
  select c.settings into commerce_settings from public.core_commerce_content c where c.restaurant_id=p_restaurant for update;
  if commerce_settings is null then raise exception 'COMMERCE_UNAVAILABLE'; end if;
  if p_input->>'fulfillment' is null or p_input->>'fulfillment' not in ('delivery','pickup') or p_input->>'paymentMethod' is null or p_input->>'paymentMethod' not in ('transfer','card') or nullif(trim(p_input#>>'{customer,name}'),'') is null or nullif(trim(p_input#>>'{customer,email}'),'') is null then raise exception 'INVALID_ORDER'; end if;
  if p_input->>'fulfillment'='delivery' then
    if not coalesce((commerce_settings->>'deliveryEnabled')::boolean,false) or nullif(trim(p_input->>'address'),'') is null or nullif(trim(p_input->>'city'),'') is null then raise exception 'DELIVERY_UNAVAILABLE'; end if;
    delivery_fee:=coalesce((commerce_settings->>'deliveryFee')::bigint,0);
  elsif not coalesce((commerce_settings->>'pickupEnabled')::boolean,false) then raise exception 'PICKUP_UNAVAILABLE'; end if;
  for item in select value from jsonb_array_elements(p_input->'items') loop
    quantity:=nullif(item->>'quantity','')::integer;
    if quantity is null or quantity not between 1 and 20 then raise exception 'INVALID_QUANTITY'; end if;
    select p.id,p.name,p.price,p.images into product_row from public.core_commerce_products p where p.id=nullif(item->>'productId','')::uuid and p.restaurant_id=p_restaurant and p.active for update;
    if product_row.id is null then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    select v.id,v.color,v.size,v.stock into variant_row from public.core_commerce_variants v where v.id=nullif(item->>'variantId','')::uuid and v.product_id=product_row.id and v.restaurant_id=p_restaurant and v.active for update;
    if variant_row.id is null then raise exception 'VARIANT_UNAVAILABLE'; end if;
    if variant_row.stock is not null and variant_row.stock<quantity then raise exception 'OUT_OF_STOCK'; end if;
    if variant_row.stock is not null then update public.core_commerce_variants set stock=stock-quantity,updated_at=now() where id=variant_row.id; end if;
    line:=jsonb_build_object('productId',product_row.id,'variantId',variant_row.id,'name',product_row.name,'image',coalesce(product_row.images->>0,null),'color',variant_row.color,'size',variant_row.size,'unitPrice',product_row.price,'quantity',quantity,'lineTotal',product_row.price*quantity);
    lines:=lines || jsonb_build_array(line);
    subtotal:=subtotal+product_row.price*quantity;
  end loop;
  total:=subtotal+delivery_fee;
  insert into public.core_commerce_customers(restaurant_id,name,email,phone) values(p_restaurant,trim(p_input#>>'{customer,name}'),lower(trim(p_input#>>'{customer,email}')),nullif(trim(p_input#>>'{customer,phone}'),'')) on conflict(restaurant_id,email) do update set name=excluded.name,phone=coalesce(excluded.phone,core_commerce_customers.phone),updated_at=now() returning id into customer_row;
  update public.core_restaurants set last_order_number=last_order_number+1,updated_at=now() where id=p_restaurant returning last_order_number into next_number;
  order_data:=jsonb_build_object('id',gen_random_uuid(),'restaurantId',p_restaurant,'number',next_number,'idempotencyKey',p_key,'items',lines,'subtotal',subtotal,'deliveryFee',delivery_fee,'total',total,'currency','ARS','customer',jsonb_build_object('name',trim(p_input#>>'{customer,name}'),'email',lower(trim(p_input#>>'{customer,email}')),'phone',nullif(trim(p_input#>>'{customer,phone}'),'')),'fulfillment',p_input->>'fulfillment','address',coalesce(trim(p_input->>'address'),''),'city',coalesce(trim(p_input->>'city'),''),'paymentMethod',p_input->>'paymentMethod','paymentStatus','pending','status','new','createdAt',now());
  insert into public.core_commerce_orders(id,restaurant_id,number,idempotency_key,customer_id,status,payment_status,total,data) values((order_data->>'id')::uuid,p_restaurant,next_number,p_key,customer_row,'new','pending',total,order_data);
  insert into public.core_audit(restaurant_id,action,details) values(p_restaurant,'commerce.order.created',jsonb_build_object('order_id',order_data->>'id','number',next_number));
  return jsonb_build_object('order',order_data,'created',true);
exception when unique_violation then
  select data into existing from public.core_commerce_orders where restaurant_id=p_restaurant and idempotency_key=p_key;
  if existing is not null then return jsonb_build_object('order',existing,'created',false); end if;
  raise;
end $$;

revoke all on function public.core_commerce_place_order(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.core_commerce_place_order(uuid,uuid,jsonb) to service_role;
grant select,insert,update,delete on public.core_commerce_members,public.core_commerce_categories,public.core_commerce_products,public.core_commerce_variants,public.core_commerce_content,public.core_commerce_customers,public.core_commerce_orders to service_role;

-- Vera Studio's own catalog/tenant data used to be seeded right here, which meant every NEW NADAV Custom
-- installation that replayed migrations 0001-0004 on a fresh Supabase project got Vera Studio's real
-- product catalog seeded into it too. That data now lives in supabase/seed/0002_vera_studio.sql, which is
-- optional and must only ever be run against Vera Studio's own project (see the header of that file).

commit;
