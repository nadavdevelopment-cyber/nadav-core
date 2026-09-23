-- NADAV Core 0.1 — integrity fixes found in the code review.
-- Can be applied on top of 0001 and 0002. Besides create/replace objects, it widens payment-status CHECK constraints to represent chargebacks explicitly.
--   * core_place_order: server-side initial state, modifier min/max/duplicate rules and promotion window enforced in SQL.
--   * core_update_order_status: compare-and-set, keeps concurrent payment updates and gives stock back on cancel.
--   * core_reconcile_payment: late/out-of-order notifications cannot downgrade an approved payment; charged_back is explicit and terminal.
--   * Mercado Pago orders are queued for printing once paid, not when created; tickets carry the restaurant time zone.
--   * Commerce: atomic catalog read (no PostgREST 1000-row cut), atomic product+variants save (ids preserved), dashboard aggregates, stock on cancel.
begin;

-- Mercado Pago can report a chargeback after an approved payment. Keep it distinct from a refund
-- so accounting and support can tell an explicit refund from a cardholder dispute/reversal.
alter table public.core_orders drop constraint if exists core_orders_payment_status_check;
alter table public.core_orders add constraint core_orders_payment_status_check check (payment_status in ('pending','approved','rejected','refunded','charged_back'));
alter table public.core_payment_intents drop constraint if exists core_payment_intents_status_check;
alter table public.core_payment_intents add constraint core_payment_intents_status_check check (status in ('creating','ready','pending','approved','rejected','refunded','charged_back'));

create or replace function public.core_place_order(p_restaurant uuid,p_key uuid,p_order jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare existing jsonb; next_number bigint; catalog jsonb; restaurant_config jsonb; item jsonb; product jsonb; modifier jsonb; group_row jsonb; option_row jsonb; product_index integer; qty integer; expected_unit bigint; expected_subtotal bigint:=0; expected_delivery bigint:=0; expected_discount bigint:=0; expected_total bigint; code text; promo jsonb; eligible bigint:=0; customer_phone text; picked integer; grp jsonb;
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
    if (select count(*) from jsonb_array_elements(coalesce(item->'modifiers','[]'::jsonb)))<>(select count(distinct (m->>'groupId')||':'||(m->>'optionId')) from jsonb_array_elements(coalesce(item->'modifiers','[]'::jsonb)) m) then raise exception 'INVALID_MODIFIER_SELECTION'; end if;
    for grp in select value from jsonb_array_elements(coalesce(product->'modifierGroups','[]'::jsonb)) loop
      select count(*) into picked from jsonb_array_elements(coalesce(item->'modifiers','[]'::jsonb)) m where m->>'groupId'=grp->>'id';
      if picked<coalesce((grp->>'min')::integer,0) or picked>coalesce((grp->>'max')::integer,0) then raise exception 'INVALID_MODIFIER_SELECTION'; end if;
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
    select value into promo from jsonb_array_elements(coalesce(catalog->'promotions','[]'::jsonb)) where upper(trim(value->>'code'))=code and coalesce((value->>'active')::boolean,false) and (nullif(value->>'startsAt','') is null or (value->>'startsAt')::timestamptz<=now()) and (nullif(value->>'endsAt','') is null or (value->>'endsAt')::timestamptz>=now()) limit 1;
    if promo is null then raise exception 'INVALID_PROMOTION'; end if;
    select coalesce(sum((value->>'lineTotal')::bigint),0) into eligible from jsonb_array_elements(p_order->'items') where jsonb_array_length(coalesce(promo->'productIds','[]'::jsonb))=0 or promo->'productIds' ? (value->>'productId');
    expected_discount:=case when promo->>'type'='percentage' then round(eligible*least(100,(promo->>'value')::numeric)/100)::bigint else least(eligible,(promo->>'value')::bigint) end;
  end if;
  expected_total:=expected_subtotal-expected_discount+expected_delivery;
  if expected_discount<>(p_order->>'discount')::bigint or expected_delivery<>(p_order->>'deliveryFee')::bigint or expected_total<>(p_order->>'total')::bigint then raise exception 'TOTAL_MISMATCH'; end if;
  update public.core_catalog_state set data=catalog,revision=revision+1,updated_at=now() where restaurant_id=p_restaurant;
  update public.core_restaurants set last_order_number=last_order_number+1,updated_at=now() where id=p_restaurant returning last_order_number into next_number;
  p_order:=jsonb_set(jsonb_set(jsonb_set(p_order,'{number}',to_jsonb(next_number),true),'{status}','"new"'::jsonb),'{paymentStatus}','"pending"'::jsonb);
  insert into public.core_orders(id,restaurant_id,number,idempotency_key,status,payment_status,total,data) values((p_order->>'id')::uuid,p_restaurant,next_number,p_key,'new','pending',expected_total,p_order);
  customer_phone:=p_order#>>'{customer,phone}';
  insert into public.core_customers(restaurant_id,phone,name,email) values(p_restaurant,customer_phone,p_order#>>'{customer,name}',nullif(p_order#>>'{customer,email}','')) on conflict(restaurant_id,phone) do update set name=excluded.name,email=coalesce(excluded.email,core_customers.email),updated_at=now();
  insert into public.core_audit(restaurant_id,action,details) values(p_restaurant,'order.created',jsonb_build_object('order_id',p_order->>'id','number',next_number));
  return jsonb_build_object('order',p_order,'created',true);
exception when unique_violation then
  select data into existing from public.core_orders where restaurant_id=p_restaurant and idempotency_key=p_key;
  if existing is not null then return jsonb_build_object('order',existing,'created',false); end if;
  raise;
end $$;

create function public.core_update_order_status(p_restaurant uuid,p_order uuid,p_expected text,p_status text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare current_status text; current_data jsonb; cfg jsonb; catalog jsonb; item jsonb; idx integer; qty integer; result jsonb;
begin
  if p_status not in ('new','confirmed','preparing','ready','on_the_way','delivered','cancelled') then raise exception 'INVALID_STATUS'; end if;
  if p_status='cancelled' then
    select config into cfg from public.core_restaurants where id=p_restaurant for update;
    select data into catalog from public.core_catalog_state where restaurant_id=p_restaurant for update;
  end if;
  select status,data into current_status,current_data from public.core_orders where restaurant_id=p_restaurant and id=p_order for update;
  if current_status is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if current_status<>p_expected then raise exception 'ORDER_CONFLICT'; end if;
  if p_status='cancelled' and catalog is not null and coalesce((cfg#>>'{features,stock}')::boolean,false) then
    for item in select value from jsonb_array_elements(coalesce(current_data->'items','[]'::jsonb)) loop
      qty:=(item->>'quantity')::integer;
      idx:=null;
      select ord::integer-1 into idx from jsonb_array_elements(catalog->'products') with ordinality rows(value,ord) where value->>'id'=item->>'productId' limit 1;
      if idx is not null and catalog->'products'->idx->'stock'<>'null'::jsonb then
        catalog:=jsonb_set(catalog,array['products',idx::text,'stock'],to_jsonb((catalog->'products'->idx->>'stock')::integer+qty),false);
      end if;
    end loop;
    update public.core_catalog_state set data=catalog,revision=revision+1,updated_at=now() where restaurant_id=p_restaurant;
  end if;
  update public.core_orders set status=p_status,data=jsonb_set(data,'{status}',to_jsonb(p_status)),updated_at=now() where restaurant_id=p_restaurant and id=p_order returning data into result;
  insert into public.core_audit(restaurant_id,action,details) values(p_restaurant,'order.status_changed',jsonb_build_object('order_id',p_order,'from',current_status,'status',p_status));
  return result;
end $$;

create or replace function public.core_reconcile_payment(p_restaurant uuid,p_order uuid,p_payment bigint,p_status text,p_amount bigint,p_external text)
returns text language plpgsql security invoker set search_path=public as $$
declare current_total bigint; current_status text; mapped text; next_status text;
begin
  select total,payment_status into current_total,current_status from public.core_orders where restaurant_id=p_restaurant and id=p_order for update;
  if current_total is null or current_total<>p_amount or p_external<>format('nadav-core:%s:%s',p_restaurant,p_order) then raise exception 'PAYMENT_MISMATCH'; end if;
  mapped:=case p_status when 'approved' then 'approved' when 'refunded' then 'refunded' when 'charged_back' then 'charged_back' when 'rejected' then 'rejected' else 'pending' end;
  -- refunded and charged_back are terminal; approved can only move to either terminal reversal state.
  next_status:=case
    when current_status in ('refunded','charged_back') then current_status
    when current_status='approved' and mapped not in ('refunded','charged_back') then 'approved'
    else mapped
  end;
  update public.core_payment_intents set payment_id=case when next_status=mapped then p_payment else payment_id end,status=next_status,updated_at=now() where restaurant_id=p_restaurant and order_id=p_order;
  if next_status is distinct from current_status then
    update public.core_orders set payment_status=next_status,data=jsonb_set(data,'{paymentStatus}',to_jsonb(next_status),true),updated_at=now() where restaurant_id=p_restaurant and id=p_order;
    insert into public.core_audit(restaurant_id,action,details) values(p_restaurant,'payment.reconciled',jsonb_build_object('order_id',p_order,'payment_id',p_payment,'status',next_status));
  end if;
  return next_status;
end $$;

create or replace function public.core_queue_auto_print()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  -- Mercado Pago orders are printed only once paid: an abandoned checkout must not send a ticket to the kitchen.
  if tg_op='INSERT' and new.data->>'paymentMethod'='mercado_pago' then return new; end if;
  if exists(select 1 from public.core_print_settings where restaurant_id=new.restaurant_id and auto_enabled and printer_id is not null and api_key_ciphertext is not null) then
    insert into public.core_print_jobs(restaurant_id,order_id,kind,status,idempotency_key) values(new.restaurant_id,new.id,'auto','pending',format('order-%s-auto',new.id)) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger core_orders_auto_print_paid after update of payment_status on public.core_orders for each row
  when (new.payment_status='approved' and old.payment_status is distinct from 'approved' and new.data->>'paymentMethod'='mercado_pago')
  execute function public.core_queue_auto_print();

create or replace function public.core_claim_print_job(p_id uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare result jsonb;
begin
  -- also re-claims a job stuck in 'processing' (the worker died before reporting)
  update public.core_print_jobs set status='processing',attempts=attempts+1,updated_at=now() where id=p_id and (status='pending' or (status='processing' and updated_at<now()-interval '5 minutes'));
  if not found then return null; end if;
  select jsonb_build_object('id',j.id,'restaurant_id',j.restaurant_id,'printer_id',s.printer_id,'paper',s.paper,'order',o.data,'restaurant_name',r.name,'time_zone',r.config#>>'{identity,timeZone}','idempotency_key',j.idempotency_key,'api_key_ciphertext',s.api_key_ciphertext) into result from public.core_print_jobs j join public.core_print_settings s using(restaurant_id) join public.core_orders o on o.id=j.order_id and o.restaurant_id=j.restaurant_id join public.core_restaurants r on r.id=j.restaurant_id where j.id=p_id;
  return result;
end $$;

-- Housekeeping: rate-limit rows and OAuth attempts otherwise grow forever. Schedule daily (pg_cron / Supabase cron): select public.core_purge_expired();
create function public.core_purge_expired() returns void language sql security invoker set search_path=public as $$
  delete from public.core_rate_limits where resets_at<now()-interval '1 day';
  delete from public.core_mp_oauth_attempts where expires_at<now();
$$;

-- ---------------------------------------------------------------- Commerce
alter table public.core_commerce_variants add column if not exists position integer not null default 0;
update public.core_commerce_variants v set position=s.rn from (select id,row_number() over (partition by product_id order by created_at,ctid) rn from public.core_commerce_variants) s where s.id=v.id and v.position=0;

create function public.core_commerce_catalog(p_restaurant uuid)
returns jsonb language sql stable security invoker set search_path=public as $$
  select jsonb_build_object(
    'categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'slug',c.slug,'name',c.name,'position',c.position,'active',c.active) order by c.position,c.name) from public.core_commerce_categories c where c.restaurant_id=p_restaurant),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'slug',p.slug,'categoryId',p.category_id,'name',p.name,'description',p.description,'price',p.price,'images',p.images,'composition',p.composition,'care',p.care,'active',p.active,
        'variants',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'sku',v.sku,'color',v.color,'colorValue',v.color_value,'size',v.size,'stock',v.stock,'active',v.active) order by v.position,v.created_at) from public.core_commerce_variants v where v.restaurant_id=p_restaurant and v.product_id=p.id),'[]'::jsonb)) order by p.created_at,p.id) from public.core_commerce_products p where p.restaurant_id=p_restaurant),'[]'::jsonb),
    'content',(select content from public.core_commerce_content where restaurant_id=p_restaurant),
    'settings',(select settings from public.core_commerce_content where restaurant_id=p_restaurant));
$$;

create function public.core_commerce_save_product(p_restaurant uuid,p_product jsonb)
returns uuid language plpgsql security invoker set search_path=public as $$
declare pid uuid; v jsonb; vid uuid; ord integer:=0; keep uuid[];
begin
  if jsonb_typeof(p_product)<>'object' or jsonb_typeof(p_product->'variants')<>'array' or jsonb_array_length(p_product->'variants') not between 1 and 100 then raise exception 'INVALID_PRODUCT'; end if;
  pid:=nullif(p_product->>'id','')::uuid;
  if pid is not null then
    update public.core_commerce_products set category_id=(p_product->>'categoryId')::uuid,slug=p_product->>'slug',name=p_product->>'name',description=coalesce(p_product->>'description',''),price=(p_product->>'price')::bigint,images=coalesce(p_product->'images','[]'::jsonb),composition=coalesce(p_product->>'composition',''),care=coalesce(p_product->>'care',''),active=coalesce((p_product->>'active')::boolean,true),updated_at=now() where id=pid and restaurant_id=p_restaurant;
    if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  else
    insert into public.core_commerce_products(restaurant_id,category_id,slug,name,description,price,images,composition,care,active) values(p_restaurant,(p_product->>'categoryId')::uuid,p_product->>'slug',p_product->>'name',coalesce(p_product->>'description',''),(p_product->>'price')::bigint,coalesce(p_product->'images','[]'::jsonb),coalesce(p_product->>'composition',''),coalesce(p_product->>'care',''),coalesce((p_product->>'active')::boolean,true)) returning id into pid;
  end if;
  -- Variants are updated in place (ids survive, so open carts keep working); only the ones removed from the form are deleted.
  select coalesce(array_agg((x->>'id')::uuid),'{}'::uuid[]) into keep from jsonb_array_elements(p_product->'variants') x where x->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  delete from public.core_commerce_variants where restaurant_id=p_restaurant and product_id=pid and id<>all(keep);
  for v in select value from jsonb_array_elements(p_product->'variants') loop
    ord:=ord+1;
    vid:=null;
    if v->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then select id into vid from public.core_commerce_variants where id=(v->>'id')::uuid and product_id=pid and restaurant_id=p_restaurant for update; end if;
    if vid is not null then
      update public.core_commerce_variants set sku=nullif(v->>'sku',''),color=v->>'color',color_value=nullif(v->>'colorValue',''),size=v->>'size',stock=nullif(v->>'stock','')::integer,active=coalesce((v->>'active')::boolean,true),position=ord,updated_at=now() where id=vid;
    else
      insert into public.core_commerce_variants(restaurant_id,product_id,sku,color,color_value,size,stock,active,position) values(p_restaurant,pid,nullif(v->>'sku',''),v->>'color',nullif(v->>'colorValue',''),v->>'size',nullif(v->>'stock','')::integer,coalesce((v->>'active')::boolean,true),ord);
    end if;
  end loop;
  return pid;
end $$;

create function public.core_commerce_dashboard(p_restaurant uuid)
returns jsonb language sql stable security invoker set search_path=public as $$
  select jsonb_build_object(
    'products',(select count(*) from public.core_commerce_products where restaurant_id=p_restaurant),
    'activeProducts',(select count(*) from public.core_commerce_products where restaurant_id=p_restaurant and active),
    'customers',(select count(*) from public.core_commerce_customers where restaurant_id=p_restaurant),
    'orders',(select count(*) from public.core_commerce_orders where restaurant_id=p_restaurant),
    'revenue',(select coalesce(sum(total),0) from public.core_commerce_orders where restaurant_id=p_restaurant and status<>'cancelled'),
    'recentOrders',coalesce((select jsonb_agg(r.data order by r.created_at desc) from (select data,created_at from public.core_commerce_orders where restaurant_id=p_restaurant order by created_at desc limit 5) r),'[]'::jsonb));
$$;

create function public.core_commerce_update_order_status(p_restaurant uuid,p_order uuid,p_expected text,p_status text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare current_status text; current_data jsonb; item jsonb; result jsonb;
begin
  if p_status not in ('new','confirmed','packing','shipped','delivered','cancelled') then raise exception 'INVALID_STATUS'; end if;
  select status,data into current_status,current_data from public.core_commerce_orders where restaurant_id=p_restaurant and id=p_order for update;
  if current_status is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if current_status<>p_expected then raise exception 'ORDER_CONFLICT'; end if;
  if p_status='cancelled' then
    for item in select value from jsonb_array_elements(coalesce(current_data->'items','[]'::jsonb)) order by value->>'variantId' loop
      update public.core_commerce_variants set stock=stock+(item->>'quantity')::integer,updated_at=now() where restaurant_id=p_restaurant and id=nullif(item->>'variantId','')::uuid and stock is not null;
    end loop;
  end if;
  update public.core_commerce_orders set status=p_status,data=jsonb_set(data,'{status}',to_jsonb(p_status)),updated_at=now() where restaurant_id=p_restaurant and id=p_order returning data into result;
  insert into public.core_audit(restaurant_id,action,details) values(p_restaurant,'commerce.order.status_changed',jsonb_build_object('order_id',p_order,'from',current_status,'status',p_status));
  return result;
end $$;

revoke all on function public.core_place_order(uuid,uuid,jsonb),public.core_update_order_status(uuid,uuid,text,text),public.core_reconcile_payment(uuid,uuid,bigint,text,bigint,text),public.core_claim_print_job(uuid),public.core_purge_expired(),public.core_commerce_catalog(uuid),public.core_commerce_save_product(uuid,jsonb),public.core_commerce_dashboard(uuid),public.core_commerce_update_order_status(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.core_place_order(uuid,uuid,jsonb),public.core_update_order_status(uuid,uuid,text,text),public.core_reconcile_payment(uuid,uuid,bigint,text,bigint,text),public.core_claim_print_job(uuid),public.core_purge_expired(),public.core_commerce_catalog(uuid),public.core_commerce_save_product(uuid,jsonb),public.core_commerce_dashboard(uuid),public.core_commerce_update_order_status(uuid,uuid,text,text) to service_role;

commit;
