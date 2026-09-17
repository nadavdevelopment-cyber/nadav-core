-- NADAV Core 0.1 — clean schema for a dedicated restaurant installation.
-- Apply once to a new Supabase project. Seed/demo data is intentionally separate.
begin;
create extension if not exists pgcrypto;
create extension if not exists citext;

create table public.core_restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9-]{2,49}$'),
  name text not null check (length(name) between 2 and 120),
  active boolean not null default true,
  config jsonb not null check (jsonb_typeof(config)='object'),
  last_order_number bigint not null default 1000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.core_catalog_state (
  restaurant_id uuid primary key references public.core_restaurants(id) on delete cascade,
  revision bigint not null default 1,
  data jsonb not null check (jsonb_typeof(data)='object'),
  updated_at timestamptz not null default now()
);

create table public.core_customers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.core_restaurants(id) on delete cascade,
  phone text not null,
  name text not null,
  email citext,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(restaurant_id,phone)
);

create table public.core_orders (
  id uuid primary key,
  restaurant_id uuid not null references public.core_restaurants(id) on delete cascade,
  number bigint not null,
  idempotency_key uuid not null,
  status text not null check (status in ('new','confirmed','preparing','ready','on_the_way','delivered','cancelled')),
  payment_status text not null check (payment_status in ('pending','approved','rejected','refunded')),
  total bigint not null check (total>=0),
  data jsonb not null check (jsonb_typeof(data)='object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(restaurant_id,idempotency_key),
  unique(restaurant_id,number)
);
create index core_orders_restaurant_date on public.core_orders(restaurant_id,created_at desc);

create table public.core_audit (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.core_restaurants(id) on delete cascade,
  actor_id text,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index core_audit_restaurant_date on public.core_audit(restaurant_id,created_at desc);

create table public.core_rate_limits (
  key text primary key check (length(key)<=160),
  hits integer not null,
  resets_at timestamptz not null
);

create table public.core_mp_oauth_attempts (
  state_hash text primary key,
  restaurant_id uuid not null references public.core_restaurants(id) on delete cascade,
  user_id text not null,
  session_hash text not null,
  code_verifier text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.core_mp_connections (
  restaurant_id uuid primary key references public.core_restaurants(id) on delete cascade,
  mp_user_id bigint not null,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table public.core_payment_intents (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.core_restaurants(id) on delete cascade,
  order_id uuid not null references public.core_orders(id) on delete cascade,
  merchant_id bigint,
  preference_id text,
  init_point text,
  payment_id bigint,
  status text not null check (status in ('creating','ready','pending','approved','rejected','refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(restaurant_id,order_id),
  unique(restaurant_id,payment_id)
);

create table public.core_print_settings (
  restaurant_id uuid primary key references public.core_restaurants(id) on delete cascade,
  api_key_ciphertext text,
  printer_id bigint check (printer_id is null or printer_id>0),
  paper text not null default '80' check (paper in ('58','80')),
  auto_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (not auto_enabled or (api_key_ciphertext is not null and printer_id is not null))
);

create table public.core_print_jobs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.core_restaurants(id) on delete cascade,
  order_id uuid not null references public.core_orders(id) on delete cascade,
  kind text not null check (kind in ('auto','manual','test')),
  status text not null check (status in ('pending','processing','submitted','failed')),
  idempotency_key text not null,
  attempts integer not null default 0,
  remote_job_id bigint,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(restaurant_id,order_id,kind,idempotency_key)
);
create unique index core_print_one_auto_per_order on public.core_print_jobs(restaurant_id,order_id) where kind='auto';

do $$ declare table_name text; begin
  foreach table_name in array array['core_restaurants','core_catalog_state','core_customers','core_orders','core_audit','core_rate_limits','core_mp_oauth_attempts','core_mp_connections','core_payment_intents','core_print_settings','core_print_jobs'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on public.%I from anon, authenticated',table_name);
  end loop;
end $$;

create function public.core_rate_check(p_key text,p_limit integer,p_window_seconds integer)
returns boolean language plpgsql security invoker set search_path=public as $$
declare current_hits integer;
begin
  if length(p_key)>160 or p_limit<1 or p_window_seconds<1 then raise exception 'INVALID_RATE'; end if;
  insert into public.core_rate_limits(key,hits,resets_at) values(p_key,1,now()+make_interval(secs=>p_window_seconds))
  on conflict(key) do update set hits=case when core_rate_limits.resets_at<now() then 1 else core_rate_limits.hits+1 end,resets_at=case when core_rate_limits.resets_at<now() then now()+make_interval(secs=>p_window_seconds) else core_rate_limits.resets_at end
  returning hits into current_hits;
  return current_hits<=p_limit;
end $$;

create function public.core_place_order(p_restaurant uuid,p_key uuid,p_order jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare existing jsonb; next_number bigint; catalog jsonb; restaurant_config jsonb; item jsonb; product jsonb; modifier jsonb; group_row jsonb; option_row jsonb; product_index integer; qty integer; expected_unit bigint; expected_subtotal bigint:=0; expected_delivery bigint:=0; expected_discount bigint:=0; expected_total bigint; code text; promo jsonb; eligible bigint:=0; customer_phone text;
begin
  select data into existing from public.core_orders where restaurant_id=p_restaurant and idempotency_key=p_key;
  if existing is not null then return jsonb_build_object('order',existing,'created',false); end if;
  if jsonb_typeof(p_order)<>'object' or pg_column_size(p_order)>200000 or (p_order->>'restaurantId')::uuid<>p_restaurant or (p_order->>'idempotencyKey')::uuid<>p_key or jsonb_typeof(p_order->'items')<>'array' or jsonb_array_length(p_order->'items') not between 1 and 100 then raise exception 'INVALID_ORDER'; end if;
  select config into restaurant_config from public.core_restaurants where id=p_restaurant and active for update;
  if restaurant_config is null then raise exception 'RESTAURANT_UNAVAILABLE'; end if;
  select data into catalog from public.core_catalog_state where restaurant_id=p_restaurant for update;
  if catalog is null then raise exception 'CATALOG_UNAVAILABLE'; end if;
  for item in select value from jsonb_array_elements(p_order->'items') loop
    qty:=(item->>'quantity')::integer;
    if qty not between 1 and 100 then raise exception 'INVALID_QUANTITY'; end if;
    select value,ord::integer-1 into product,product_index from jsonb_array_elements(catalog->'products') with ordinality rows(value,ord) where value->>'id'=item->>'productId' and coalesce((value->>'available')::boolean,false) limit 1;
    if product is null then raise exception 'PRODUCT_UNAVAILABLE'; end if;
    if coalesce((restaurant_config#>>'{features,stock}')::boolean,false) and product->'stock'<>'null'::jsonb and (product->>'stock')::integer<qty then raise exception 'OUT_OF_STOCK'; end if;
    expected_unit:=coalesce((product->>'promotionalPrice')::bigint,(product->>'price')::bigint);
    for modifier in select value from jsonb_array_elements(coalesce(item->'modifiers','[]'::jsonb)) loop
      select value into group_row from jsonb_array_elements(coalesce(product->'modifierGroups','[]'::jsonb)) where value->>'id'=modifier->>'groupId' limit 1;
      select value into option_row from jsonb_array_elements(coalesce(group_row->'options','[]'::jsonb)) where value->>'id'=modifier->>'optionId' and coalesce((value->>'available')::boolean,false) limit 1;
      if option_row is null then raise exception 'INVALID_MODIFIER'; end if;
      expected_unit:=expected_unit+(option_row->>'price')::bigint;
    end loop;
    if expected_unit<>(item->>'unitPrice')::bigint or expected_unit*qty<>(item->>'lineTotal')::bigint then raise exception 'PRICE_MISMATCH'; end if;
    expected_subtotal:=expected_subtotal+expected_unit*qty;
    if coalesce((restaurant_config#>>'{features,stock}')::boolean,false) and product->'stock'<>'null'::jsonb then catalog:=jsonb_set(catalog,array['products',product_index::text,'stock'],to_jsonb((product->>'stock')::integer-qty),false); end if;
  end loop;
  if expected_subtotal<>(p_order->>'subtotal')::bigint or expected_subtotal<coalesce((restaurant_config#>>'{ordering,minimumOrder}')::bigint,0) then raise exception 'SUBTOTAL_MISMATCH'; end if;
  if p_order->>'mode'='delivery' then
    if not coalesce((restaurant_config#>>'{features,delivery}')::boolean,false) or nullif(trim(p_order->>'address'),'') is null then raise exception 'DELIVERY_UNAVAILABLE'; end if;
    if nullif(p_order->>'deliveryZoneId','') is not null then select (value->>'fee')::bigint into expected_delivery from jsonb_array_elements(coalesce(catalog->'deliveryZones','[]'::jsonb)) where value->>'id'=p_order->>'deliveryZoneId' and coalesce((value->>'active')::boolean,false) limit 1; end if;
    expected_delivery:=coalesce(expected_delivery,(restaurant_config#>>'{ordering,baseDeliveryFee}')::bigint,0);
  elsif p_order->>'mode'<>'pickup' or not coalesce((restaurant_config#>>'{features,pickup}')::boolean,false) then raise exception 'PICKUP_UNAVAILABLE'; end if;
  code:=upper(trim(coalesce(p_order->>'promotionCode','')));
  if code<>'' then
    if not coalesce((restaurant_config#>>'{features,promotions}')::boolean,false) then raise exception 'PROMOTIONS_DISABLED'; end if;
    select value into promo from jsonb_array_elements(coalesce(catalog->'promotions','[]'::jsonb)) where upper(trim(value->>'code'))=code and coalesce((value->>'active')::boolean,false) limit 1;
    if promo is null then raise exception 'INVALID_PROMOTION'; end if;
    select coalesce(sum((value->>'lineTotal')::bigint),0) into eligible from jsonb_array_elements(p_order->'items') where jsonb_array_length(coalesce(promo->'productIds','[]'::jsonb))=0 or promo->'productIds' ? (value->>'productId');
    expected_discount:=case when promo->>'type'='percentage' then round(eligible*least(100,(promo->>'value')::numeric)/100)::bigint else least(eligible,(promo->>'value')::bigint) end;
  end if;
  expected_total:=expected_subtotal-expected_discount+expected_delivery;
  if expected_discount<>(p_order->>'discount')::bigint or expected_delivery<>(p_order->>'deliveryFee')::bigint or expected_total<>(p_order->>'total')::bigint then raise exception 'TOTAL_MISMATCH'; end if;
  update public.core_catalog_state set data=catalog,revision=revision+1,updated_at=now() where restaurant_id=p_restaurant;
  update public.core_restaurants set last_order_number=last_order_number+1,updated_at=now() where id=p_restaurant returning last_order_number into next_number;
  p_order:=jsonb_set(p_order,'{number}',to_jsonb(next_number),true);
  insert into public.core_orders(id,restaurant_id,number,idempotency_key,status,payment_status,total,data) values((p_order->>'id')::uuid,p_restaurant,next_number,p_key,p_order->>'status',p_order->>'paymentStatus',expected_total,p_order);
  customer_phone:=p_order#>>'{customer,phone}';
  insert into public.core_customers(restaurant_id,phone,name,email) values(p_restaurant,customer_phone,p_order#>>'{customer,name}',nullif(p_order#>>'{customer,email}','')) on conflict(restaurant_id,phone) do update set name=excluded.name,email=coalesce(excluded.email,core_customers.email),updated_at=now();
  insert into public.core_audit(restaurant_id,action,details) values(p_restaurant,'order.created',jsonb_build_object('order_id',p_order->>'id','number',next_number));
  return jsonb_build_object('order',p_order,'created',true);
exception when unique_violation then
  select data into existing from public.core_orders where restaurant_id=p_restaurant and idempotency_key=p_key;
  if existing is not null then return jsonb_build_object('order',existing,'created',false); end if;
  raise;
end $$;

create function public.core_mp_consume_attempt(p_hash text,p_restaurant uuid,p_user text,p_session_hash text)
returns text language plpgsql security invoker set search_path=public as $$
declare verifier text;
begin
  delete from public.core_mp_oauth_attempts where state_hash=p_hash and restaurant_id=p_restaurant and user_id=p_user and session_hash=p_session_hash and expires_at>now() returning code_verifier into verifier;
  return verifier;
end $$;

create function public.core_reconcile_payment(p_restaurant uuid,p_order uuid,p_payment bigint,p_status text,p_amount bigint,p_external text)
returns text language plpgsql security invoker set search_path=public as $$
declare current_total bigint; mapped text;
begin
  select total into current_total from public.core_orders where restaurant_id=p_restaurant and id=p_order for update;
  if current_total is null or current_total<>p_amount or p_external<>format('nadav-core:%s:%s',p_restaurant,p_order) then raise exception 'PAYMENT_MISMATCH'; end if;
  mapped:=case p_status when 'approved' then 'approved' when 'refunded' then 'refunded' when 'rejected' then 'rejected' else 'pending' end;
  update public.core_payment_intents set payment_id=p_payment,status=mapped,updated_at=now() where restaurant_id=p_restaurant and order_id=p_order;
  update public.core_orders set payment_status=mapped,data=jsonb_set(data,'{paymentStatus}',to_jsonb(mapped),true),updated_at=now() where restaurant_id=p_restaurant and id=p_order and payment_status is distinct from mapped;
  insert into public.core_audit(restaurant_id,action,details) values(p_restaurant,'payment.reconciled',jsonb_build_object('order_id',p_order,'payment_id',p_payment,'status',mapped));
  return mapped;
end $$;

create function public.core_queue_auto_print()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if exists(select 1 from public.core_print_settings where restaurant_id=new.restaurant_id and auto_enabled and printer_id is not null and api_key_ciphertext is not null) then
    insert into public.core_print_jobs(restaurant_id,order_id,kind,status,idempotency_key) values(new.restaurant_id,new.id,'auto','pending',format('order-%s-auto',new.id)) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger core_orders_auto_print after insert on public.core_orders for each row execute function public.core_queue_auto_print();

create function public.core_claim_print_job(p_id uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare result jsonb;
begin
  update public.core_print_jobs set status='processing',attempts=attempts+1,updated_at=now() where id=p_id and status='pending';
  if not found then return null; end if;
  select jsonb_build_object('id',j.id,'restaurant_id',j.restaurant_id,'printer_id',s.printer_id,'paper',s.paper,'order',o.data,'restaurant_name',r.name,'idempotency_key',j.idempotency_key,'api_key_ciphertext',s.api_key_ciphertext) into result from public.core_print_jobs j join public.core_print_settings s using(restaurant_id) join public.core_orders o on o.id=j.order_id and o.restaurant_id=j.restaurant_id join public.core_restaurants r on r.id=j.restaurant_id where j.id=p_id;
  return result;
end $$;

revoke all on function public.core_rate_check(text,integer,integer),public.core_place_order(uuid,uuid,jsonb),public.core_mp_consume_attempt(text,uuid,text,text),public.core_reconcile_payment(uuid,uuid,bigint,text,bigint,text),public.core_claim_print_job(uuid) from public,anon,authenticated;
grant execute on function public.core_rate_check(text,integer,integer),public.core_place_order(uuid,uuid,jsonb),public.core_mp_consume_attempt(text,uuid,text,text),public.core_reconcile_payment(uuid,uuid,bigint,text,bigint,text),public.core_claim_print_job(uuid) to service_role;
grant select,insert,update,delete on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('nadav-core-media','nadav-core-media',true,2097152,array['image/jpeg','image/png','image/webp']) on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
commit;
