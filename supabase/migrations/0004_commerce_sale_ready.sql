-- NADAV Core 0.1 — Commerce production/sale readiness.
-- Fixes replay/idempotency semantics, removes fake card checkout, records manual
-- transfer payment state and makes dashboard revenue mean money actually approved.
begin;

create or replace function public.core_commerce_same_checkout(p_order jsonb,p_input jsonb)
returns boolean language sql immutable security invoker set search_path=public as $$
  select
    coalesce(trim(p_order#>>'{customer,name}'),'') = coalesce(trim(p_input#>>'{customer,name}'),'')
    and lower(coalesce(trim(p_order#>>'{customer,email}'),'')) = lower(coalesce(trim(p_input#>>'{customer,email}'),''))
    and coalesce(trim(p_order#>>'{customer,phone}'),'') = coalesce(trim(p_input#>>'{customer,phone}'),'')
    and coalesce(p_order->>'fulfillment','') = coalesce(p_input->>'fulfillment','')
    and coalesce(trim(p_order->>'address'),'') = coalesce(trim(p_input->>'address'),'')
    and coalesce(trim(p_order->>'city'),'') = coalesce(trim(p_input->>'city'),'')
    and coalesce(p_order->>'paymentMethod','') = coalesce(p_input->>'paymentMethod','')
    and coalesce((
      select jsonb_agg(
        jsonb_build_array(coalesce(x->>'productId',''),coalesce(x->>'variantId',''),coalesce(x->>'quantity',''))
        order by coalesce(x->>'productId',''),coalesce(x->>'variantId',''),coalesce(x->>'quantity','')
      )
      from jsonb_array_elements(coalesce(p_order->'items','[]'::jsonb)) x
    ),'[]'::jsonb) = coalesce((
      select jsonb_agg(
        jsonb_build_array(coalesce(x->>'productId',''),coalesce(x->>'variantId',''),coalesce(x->>'quantity',''))
        order by coalesce(x->>'productId',''),coalesce(x->>'variantId',''),coalesce(x->>'quantity','')
      )
      from jsonb_array_elements(coalesce(p_input->'items','[]'::jsonb)) x
    ),'[]'::jsonb);
$$;

create or replace function public.core_commerce_place_order(p_restaurant uuid,p_key uuid,p_input jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare existing jsonb; item jsonb; product_row record; variant_row record; line jsonb; lines jsonb:='[]'::jsonb; next_number bigint; subtotal bigint:=0; delivery_fee bigint:=0; total bigint; order_data jsonb; customer_row uuid; commerce_settings jsonb; quantity integer;
begin
  if jsonb_typeof(p_input)<>'object' or jsonb_typeof(p_input->'items')<>'array' or jsonb_array_length(p_input->'items') not between 1 and 40 then raise exception 'INVALID_ORDER'; end if;
  select data into existing from public.core_commerce_orders where restaurant_id=p_restaurant and idempotency_key=p_key;
  if existing is not null then
    if not public.core_commerce_same_checkout(existing,p_input) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('order',existing,'created',false);
  end if;
  select c.settings into commerce_settings from public.core_commerce_content c where c.restaurant_id=p_restaurant for update;
  if commerce_settings is null then raise exception 'COMMERCE_UNAVAILABLE'; end if;
  if p_input->>'fulfillment' is null or p_input->>'fulfillment' not in ('delivery','pickup') or p_input->>'paymentMethod' is null or nullif(trim(p_input#>>'{customer,name}'),'') is null or nullif(trim(p_input#>>'{customer,email}'),'') is null then raise exception 'INVALID_ORDER'; end if;
  if p_input->>'paymentMethod'<>'transfer' then raise exception 'PAYMENT_NOT_CONFIGURED'; end if;
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
  order_data:=jsonb_build_object('id',gen_random_uuid(),'restaurantId',p_restaurant,'number',next_number,'idempotencyKey',p_key,'items',lines,'subtotal',subtotal,'deliveryFee',delivery_fee,'total',total,'currency','ARS','customer',jsonb_build_object('name',trim(p_input#>>'{customer,name}'),'email',lower(trim(p_input#>>'{customer,email}')),'phone',nullif(trim(p_input#>>'{customer,phone}'),'')),'fulfillment',p_input->>'fulfillment','address',coalesce(trim(p_input->>'address'),''),'city',coalesce(trim(p_input->>'city'),''),'paymentMethod','transfer','paymentStatus','pending','status','new','createdAt',now());
  insert into public.core_commerce_orders(id,restaurant_id,number,idempotency_key,customer_id,status,payment_status,total,data) values((order_data->>'id')::uuid,p_restaurant,next_number,p_key,customer_row,'new','pending',total,order_data);
  insert into public.core_audit(restaurant_id,action,details) values(p_restaurant,'commerce.order.created',jsonb_build_object('order_id',order_data->>'id','number',next_number));
  return jsonb_build_object('order',order_data,'created',true);
exception when unique_violation then
  select data into existing from public.core_commerce_orders where restaurant_id=p_restaurant and idempotency_key=p_key;
  if existing is not null then
    if not public.core_commerce_same_checkout(existing,p_input) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('order',existing,'created',false);
  end if;
  raise;
end $$;

create or replace function public.core_commerce_update_payment_status(p_restaurant uuid,p_order uuid,p_expected text,p_status text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare current_status text; current_data jsonb; result jsonb;
begin
  if p_status not in ('pending','approved','rejected','refunded') then raise exception 'INVALID_PAYMENT_STATUS'; end if;
  select payment_status,data into current_status,current_data from public.core_commerce_orders where restaurant_id=p_restaurant and id=p_order for update;
  if current_status is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if current_status=p_status then return current_data; end if;
  if current_status<>p_expected then raise exception 'ORDER_CONFLICT'; end if;
  if current_data->>'paymentMethod'<>'transfer' then raise exception 'PAYMENT_NOT_CONFIGURED'; end if;
  if not (
    (current_status='pending' and p_status in ('approved','rejected'))
    or (current_status='rejected' and p_status='approved')
    or (current_status='approved' and p_status='refunded')
  ) then raise exception 'INVALID_PAYMENT_TRANSITION'; end if;
  update public.core_commerce_orders set payment_status=p_status,data=jsonb_set(data,'{paymentStatus}',to_jsonb(p_status)),updated_at=now() where restaurant_id=p_restaurant and id=p_order returning data into result;
  insert into public.core_audit(restaurant_id,action,details) values(p_restaurant,'commerce.payment_status_changed',jsonb_build_object('order_id',p_order,'from',current_status,'status',p_status));
  return result;
end $$;

-- A paid order must be refunded before it is cancelled. This prevents an admin
-- from returning stock / hiding revenue while the merchant still holds the money.
create or replace function public.core_guard_paid_cancel()
returns trigger language plpgsql security invoker set search_path=public as $$
begin
  if new.status='cancelled' and old.status is distinct from 'cancelled' and old.payment_status='approved' then
    raise exception 'PAYMENT_REFUND_REQUIRED';
  end if;
  return new;
end $$;

drop trigger if exists core_orders_require_refund_before_cancel on public.core_orders;
create trigger core_orders_require_refund_before_cancel
before update of status on public.core_orders for each row execute function public.core_guard_paid_cancel();
drop trigger if exists core_commerce_orders_require_refund_before_cancel on public.core_commerce_orders;
create trigger core_commerce_orders_require_refund_before_cancel
before update of status on public.core_commerce_orders for each row execute function public.core_guard_paid_cancel();

create or replace function public.core_claim_print_job(p_id uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare result jsonb;
begin
  update public.core_print_jobs
  set status='processing',attempts=attempts+1,updated_at=now()
  where id=p_id and attempts<5 and (
    status='pending'
    or (status='processing' and updated_at<now()-interval '5 minutes')
    or (status='failed' and updated_at<now()-interval '1 minute')
  );
  if not found then return null; end if;
  select jsonb_build_object('id',j.id,'restaurant_id',j.restaurant_id,'printer_id',s.printer_id,'paper',s.paper,'order',o.data,'restaurant_name',r.name,'time_zone',r.config#>>'{identity,timeZone}','idempotency_key',j.idempotency_key,'api_key_ciphertext',s.api_key_ciphertext)
  into result
  from public.core_print_jobs j
  join public.core_print_settings s using(restaurant_id)
  join public.core_orders o on o.id=j.order_id and o.restaurant_id=j.restaurant_id
  join public.core_restaurants r on r.id=j.restaurant_id
  where j.id=p_id;
  return result;
end $$;

create or replace function public.core_commerce_dashboard(p_restaurant uuid)
returns jsonb language sql stable security invoker set search_path=public as $$
  select jsonb_build_object(
    'products',(select count(*) from public.core_commerce_products where restaurant_id=p_restaurant),
    'activeProducts',(select count(*) from public.core_commerce_products where restaurant_id=p_restaurant and active),
    'customers',(select count(*) from public.core_commerce_customers where restaurant_id=p_restaurant),
    'orders',(select count(*) from public.core_commerce_orders where restaurant_id=p_restaurant),
    'revenue',(select coalesce(sum(total),0) from public.core_commerce_orders where restaurant_id=p_restaurant and payment_status='approved' and status<>'cancelled'),
    'recentOrders',coalesce((select jsonb_agg(r.data order by r.created_at desc) from (select data,created_at from public.core_commerce_orders where restaurant_id=p_restaurant order by created_at desc limit 5) r),'[]'::jsonb));
$$;

revoke all on function public.core_commerce_same_checkout(jsonb,jsonb),public.core_commerce_place_order(uuid,uuid,jsonb),public.core_commerce_update_payment_status(uuid,uuid,text,text),public.core_commerce_dashboard(uuid),public.core_claim_print_job(uuid),public.core_guard_paid_cancel() from public,anon,authenticated;
grant execute on function public.core_commerce_same_checkout(jsonb,jsonb),public.core_commerce_place_order(uuid,uuid,jsonb),public.core_commerce_update_payment_status(uuid,uuid,text,text),public.core_commerce_dashboard(uuid),public.core_claim_print_job(uuid),public.core_guard_paid_cancel() to service_role;

commit;
