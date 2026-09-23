-- Integration test for all Core migrations. Run with scripts/test-sql.sh against a scratch database.
-- Every assertion raises an exception on failure, so `psql -v ON_ERROR_STOP=1` fails the run.
begin;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAILED: %', label; end if; raise notice 'ok - %', label; end $$;
create or replace function pg_temp.raises(stmt text, expected text) returns void language plpgsql as $$
begin execute stmt; raise exception 'FAILED: expected % but nothing was raised (%)', expected, stmt;
exception when others then if sqlerrm <> expected then raise exception 'FAILED: expected % got % (%)', expected, sqlerrm, stmt; end if; raise notice 'ok - raises %', expected; end $$;

insert into core_restaurants(id,slug,name,config) values ('11111111-1111-4111-8111-111111111111','test-kitchen','Test Kitchen',
 '{"identity":{"timeZone":"America/Argentina/Buenos_Aires"},"features":{"stock":true,"delivery":true,"pickup":true,"promotions":true},"ordering":{"minimumOrder":0,"baseDeliveryFee":500}}');
insert into core_catalog_state(restaurant_id,revision,data) values ('11111111-1111-4111-8111-111111111111',1,
 '{"categories":[],"deliveryZones":[],
   "promotions":[{"id":"old","code":"OLD","type":"percentage","value":10,"active":true,"productIds":[],"endsAt":"2020-01-01T00:00:00Z"}],
   "products":[{"id":"burger","available":true,"price":1000,"stock":5,"modifierGroups":[]},
               {"id":"combo","available":true,"price":2000,"stock":null,"modifierGroups":[{"id":"size","min":1,"max":1,"options":[{"id":"l","price":300,"available":true}]}]}]}');
insert into core_print_settings(restaurant_id,api_key_ciphertext,printer_id,auto_enabled) values ('11111111-1111-4111-8111-111111111111','x',7,true);

create or replace function pg_temp.order_json(id text, key text, method text, items jsonb, total bigint) returns jsonb language sql as $$
  select jsonb_build_object('id',id,'restaurantId','11111111-1111-4111-8111-111111111111','idempotencyKey',key,'items',items,'subtotal',total,'discount',0,'deliveryFee',0,'total',total,
   'mode','pickup','status','delivered','paymentStatus','approved','paymentMethod',method,'customer',jsonb_build_object('name','Ada','phone','22155500')) $$;

-- 1. place order: stock, forced initial state (payload said delivered/approved), replay
select pg_temp.check((core_place_order('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  pg_temp.order_json('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cash','[{"productId":"burger","quantity":2,"modifiers":[],"unitPrice":1000,"lineTotal":2000}]'::jsonb,2000))->>'created')::boolean,'order created');
select pg_temp.check((select status='new' and payment_status='pending' and data->>'status'='new' and data->>'paymentStatus'='pending' from core_orders where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),'initial state is set by SQL, not by the caller');
select pg_temp.check((select (data->'products'->0->>'stock')::int=3 from core_catalog_state),'stock decremented');
select pg_temp.check(not (core_place_order('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{}'::jsonb)->>'created')::boolean,'idempotent replay returns created=false');

-- 2. modifier rules and promotion window enforced in SQL
select pg_temp.raises($q$select core_place_order('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  pg_temp.order_json('dddddddd-dddd-4ddd-8ddd-dddddddddddd','cccccccc-cccc-4ccc-8ccc-cccccccccccc','cash','[{"productId":"combo","quantity":1,"modifiers":[],"unitPrice":2000,"lineTotal":2000}]'::jsonb,2000))$q$,'INVALID_MODIFIER_SELECTION');
select pg_temp.raises($q$select core_place_order('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  pg_temp.order_json('dddddddd-dddd-4ddd-8ddd-dddddddddddd','cccccccc-cccc-4ccc-8ccc-cccccccccccc','cash','[{"productId":"burger","quantity":1,"modifiers":[],"unitPrice":1000,"lineTotal":1000}]'::jsonb,1000)||'{"promotionCode":"OLD","discount":100,"total":900}'::jsonb)$q$,'INVALID_PROMOTION');
select pg_temp.raises($q$select core_place_order('11111111-1111-4111-8111-111111111111','cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  pg_temp.order_json('dddddddd-dddd-4ddd-8ddd-dddddddddddd','cccccccc-cccc-4ccc-8ccc-cccccccccccc','cash','[{"productId":"burger","quantity":9,"modifiers":[],"unitPrice":1000,"lineTotal":9000}]'::jsonb,9000))$q$,'OUT_OF_STOCK');

-- 3. status change is compare-and-set and does not clobber a concurrent payment update
select pg_temp.raises($q$select core_update_order_status('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','confirmed','preparing')$q$,'ORDER_CONFLICT');
select pg_temp.raises($q$select core_update_order_status('11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999999','new','confirmed')$q$,'ORDER_NOT_FOUND');
insert into core_payment_intents(restaurant_id,order_id,status) values ('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','ready');
select pg_temp.check(core_reconcile_payment('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,'approved',2000,'nadav-core:11111111-1111-4111-8111-111111111111:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')='approved','payment approved');
select pg_temp.check((core_update_order_status('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','new','confirmed')->>'paymentStatus')='approved','status update keeps data.paymentStatus');

-- 4. payments never go backwards
select pg_temp.check(core_reconcile_payment('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',2,'in_process',2000,'nadav-core:11111111-1111-4111-8111-111111111111:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')='approved','late in_process does not downgrade approved');
select pg_temp.check(core_reconcile_payment('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',2,'rejected',2000,'nadav-core:11111111-1111-4111-8111-111111111111:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')='approved','late rejected does not downgrade approved');
select pg_temp.check((select payment_id=1 from core_payment_intents),'stale notification does not overwrite payment_id');
select pg_temp.check(core_reconcile_payment('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,'refunded',2000,'nadav-core:11111111-1111-4111-8111-111111111111:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')='refunded','approved -> refunded allowed');
select pg_temp.check(core_reconcile_payment('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1,'approved',2000,'nadav-core:11111111-1111-4111-8111-111111111111:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')='refunded','refunded is terminal');

-- An approved payment can later become a chargeback, and chargeback is terminal.
insert into core_orders(id,restaurant_id,number,idempotency_key,status,payment_status,total,data) values(
  'abababab-abab-4bab-8bab-abababababab','11111111-1111-4111-8111-111111111111',9998,'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd','new','approved',1000,
  pg_temp.order_json('abababab-abab-4bab-8bab-abababababab','cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd','mercado_pago','[]'::jsonb,1000)||'{"status":"new","paymentStatus":"approved"}'::jsonb
);
insert into core_payment_intents(restaurant_id,order_id,status,payment_id) values ('11111111-1111-4111-8111-111111111111','abababab-abab-4bab-8bab-abababababab','approved',9);
select pg_temp.check(core_reconcile_payment('11111111-1111-4111-8111-111111111111','abababab-abab-4bab-8bab-abababababab',10,'charged_back',1000,'nadav-core:11111111-1111-4111-8111-111111111111:abababab-abab-4bab-8bab-abababababab')='charged_back','approved -> charged_back allowed');
select pg_temp.check(core_reconcile_payment('11111111-1111-4111-8111-111111111111','abababab-abab-4bab-8bab-abababababab',11,'approved',1000,'nadav-core:11111111-1111-4111-8111-111111111111:abababab-abab-4bab-8bab-abababababab')='charged_back','charged_back is terminal');
select pg_temp.check((select payment_id=10 from core_payment_intents where order_id='abababab-abab-4bab-8bab-abababababab'),'chargeback stores the chargeback payment id');
update core_orders set payment_status='approved',data=jsonb_set(data,'{paymentStatus}','"approved"'::jsonb) where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select pg_temp.raises($q$select core_update_order_status('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','confirmed','cancelled')$q$,'PAYMENT_REFUND_REQUIRED');
update core_orders set payment_status='refunded',data=jsonb_set(data,'{paymentStatus}','"refunded"'::jsonb) where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

-- 5. cancelling returns the stock (3 + 2 = 5) and bumps the catalog revision
select pg_temp.check((core_update_order_status('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','confirmed','cancelled')->>'status')='cancelled','order cancelled');
select pg_temp.check((select (data->'products'->0->>'stock')::int=5 from core_catalog_state),'cancel restores stock');

-- 6. printing: cash orders queue at creation, Mercado Pago only once paid
select pg_temp.check((select count(*)=1 from core_print_jobs where order_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and kind='auto'),'cash order queued a print job on creation');
select core_place_order('11111111-1111-4111-8111-111111111111','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  pg_temp.order_json('ffffffff-ffff-4fff-8fff-ffffffffffff','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','mercado_pago','[{"productId":"burger","quantity":1,"modifiers":[],"unitPrice":1000,"lineTotal":1000}]'::jsonb,1000));
select pg_temp.check((select count(*)=0 from core_print_jobs where order_id='ffffffff-ffff-4fff-8fff-ffffffffffff'),'unpaid Mercado Pago order is not printed');
insert into core_payment_intents(restaurant_id,order_id,status) values ('11111111-1111-4111-8111-111111111111','ffffffff-ffff-4fff-8fff-ffffffffffff','ready');
select core_reconcile_payment('11111111-1111-4111-8111-111111111111','ffffffff-ffff-4fff-8fff-ffffffffffff',5,'approved',1000,'nadav-core:11111111-1111-4111-8111-111111111111:ffffffff-ffff-4fff-8fff-ffffffffffff');
select pg_temp.check((select count(*)=1 from core_print_jobs where order_id='ffffffff-ffff-4fff-8fff-ffffffffffff' and kind='auto'),'paid Mercado Pago order queues its print job');
select pg_temp.check((core_claim_print_job((select id from core_print_jobs where order_id='ffffffff-ffff-4fff-8fff-ffffffffffff')))->>'time_zone'='America/Argentina/Buenos_Aires','print job carries the restaurant time zone');
update core_print_jobs set status='failed',updated_at=now()-interval '2 minutes' where order_id='ffffffff-ffff-4fff-8fff-ffffffffffff';
select pg_temp.check((core_claim_print_job((select id from core_print_jobs where order_id='ffffffff-ffff-4fff-8fff-ffffffffffff')))->>'id' is not null,'failed print job can be reclaimed');
select pg_temp.check((select status='processing' and attempts=2 from core_print_jobs where order_id='ffffffff-ffff-4fff-8fff-ffffffffffff'),'print retry increments attempts and reclaims the job');

-- 7. housekeeping
insert into core_rate_limits(key,hits,resets_at) values ('old',1,now()-interval '3 days'),('fresh',1,now()+interval '1 hour');
select core_purge_expired();
select pg_temp.check((select count(*)=0 from core_rate_limits where key='old') and (select count(*)=1 from core_rate_limits where key='fresh'),'purge removes only expired rate limits');

-- 8. Commerce: atomic save keeps variant ids, catalog RPC, dashboard, stock on cancel
insert into core_restaurants(id,slug,name,config) values ('22222222-2222-4222-8222-222222222222','shop','Shop','{}');
insert into core_commerce_content(restaurant_id,content,settings) values ('22222222-2222-4222-8222-222222222222','{}','{"pickupEnabled":true,"deliveryEnabled":true,"deliveryFee":100}');
insert into core_commerce_categories(id,restaurant_id,slug,name) values ('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','tops','Tops');
select core_commerce_save_product('22222222-2222-4222-8222-222222222222',
  '{"categoryId":"33333333-3333-4333-8333-333333333333","slug":"remera","name":"Remera","price":1000,"images":[],"variants":[{"color":"Negro","size":"S","stock":10},{"color":"Negro","size":"M","stock":10},{"color":"Negro","size":"L","stock":10}]}'::jsonb) as pid \gset
select pg_temp.check((select count(*)=3 from core_commerce_variants where product_id=:'pid'),'product saved with 3 variants');
select pg_temp.check((select array_agg(size order by position) = array['S','M','L'] from core_commerce_variants where product_id=:'pid'),'variant order is stable');
select id as vs from core_commerce_variants where product_id=:'pid' and size='S' \gset
select id as vm from core_commerce_variants where product_id=:'pid' and size='M' \gset
select core_commerce_save_product('22222222-2222-4222-8222-222222222222', jsonb_build_object('id',:'pid','categoryId','33333333-3333-4333-8333-333333333333','slug','remera','name','Remera v2','price',1200,'images','[]'::jsonb,
  'variants', jsonb_build_array(jsonb_build_object('id',:'vs','color','Negro','size','S','stock',7), jsonb_build_object('id',:'vm','color','Negro','size','M','stock',10), jsonb_build_object('color','Negro','size','XL','stock',4))));
select pg_temp.check((select count(*)=3 from core_commerce_variants where product_id=:'pid') and exists(select 1 from core_commerce_variants where id=:'vs' and stock=7) and exists(select 1 from core_commerce_variants where id=:'vm'),'re-save keeps variant ids, updates stock, drops removed L, adds XL');
select pg_temp.check((select jsonb_array_length(core_commerce_catalog('22222222-2222-4222-8222-222222222222')->'products'->0->'variants')=3),'catalog RPC returns nested variants');
select core_commerce_place_order('22222222-2222-4222-8222-222222222222','aaaaaaaa-0000-4aaa-8aaa-aaaaaaaaaaaa',
  jsonb_build_object('items',jsonb_build_array(jsonb_build_object('productId',:'pid','variantId',:'vs','quantity',3)),'customer','{"name":"Ada","email":"a@b.co"}'::jsonb,'fulfillment','pickup','paymentMethod','transfer')) as placed \gset
select pg_temp.check((select stock=4 from core_commerce_variants where id=:'vs'),'commerce order took 3 units');
select pg_temp.check((core_commerce_dashboard('22222222-2222-4222-8222-222222222222')->>'orders')::int=1 and (core_commerce_dashboard('22222222-2222-4222-8222-222222222222')->>'revenue')::int=0,'dashboard excludes pending transfers from revenue');
select pg_temp.check(not (core_commerce_place_order('22222222-2222-4222-8222-222222222222','aaaaaaaa-0000-4aaa-8aaa-aaaaaaaaaaaa',
  jsonb_build_object('items',jsonb_build_array(jsonb_build_object('productId',:'pid','variantId',:'vs','quantity',3)),'customer','{"name":"Ada","email":"a@b.co"}'::jsonb,'fulfillment','pickup','paymentMethod','transfer'))->>'created')::boolean,'commerce retry returns the original order');
select pg_temp.raises(format($q$select core_commerce_place_order('22222222-2222-4222-8222-222222222222','aaaaaaaa-0000-4aaa-8aaa-aaaaaaaaaaaa',
  jsonb_build_object('items',jsonb_build_array(jsonb_build_object('productId','%s','variantId','%s','quantity',2)),'customer','{"name":"Ada","email":"a@b.co"}'::jsonb,'fulfillment','pickup','paymentMethod','transfer'))$q$,:'pid',:'vs'),'IDEMPOTENCY_CONFLICT');
select pg_temp.raises(format($q$select core_commerce_place_order('22222222-2222-4222-8222-222222222222','bbbbbbbb-0000-4bbb-8bbb-bbbbbbbbbbbb',
  jsonb_build_object('items',jsonb_build_array(jsonb_build_object('productId','%s','variantId','%s','quantity',1)),'customer','{"name":"Ada","email":"a@b.co"}'::jsonb,'fulfillment','pickup','paymentMethod','card'))$q$,:'pid',:'vs'),'PAYMENT_NOT_CONFIGURED');
select pg_temp.check((core_commerce_update_payment_status('22222222-2222-4222-8222-222222222222',(:'placed'::jsonb->'order'->>'id')::uuid,'pending','approved')->>'paymentStatus')='approved','commerce transfer can be marked paid');
select pg_temp.check((core_commerce_dashboard('22222222-2222-4222-8222-222222222222')->>'revenue')::int=3600,'dashboard revenue counts approved payments only');
select pg_temp.raises(format($q$select core_commerce_update_order_status('22222222-2222-4222-8222-222222222222','%s','new','cancelled')$q$,(:'placed'::jsonb->'order'->>'id')),'PAYMENT_REFUND_REQUIRED');
select pg_temp.raises(format($q$select core_commerce_update_payment_status('22222222-2222-4222-8222-222222222222','%s','pending','refunded')$q$,(:'placed'::jsonb->'order'->>'id')),'ORDER_CONFLICT');
select pg_temp.check((core_commerce_update_payment_status('22222222-2222-4222-8222-222222222222',(:'placed'::jsonb->'order'->>'id')::uuid,'approved','refunded')->>'paymentStatus')='refunded','approved transfer can be marked refunded');
select core_commerce_update_order_status('22222222-2222-4222-8222-222222222222',(:'placed'::jsonb->'order'->>'id')::uuid,'new','cancelled');
select pg_temp.check((select stock=7 from core_commerce_variants where id=:'vs'),'commerce cancel restores stock');
select pg_temp.check((core_commerce_dashboard('22222222-2222-4222-8222-222222222222')->>'revenue')::int=0,'cancelled commerce orders are excluded from revenue');
select pg_temp.raises(format($q$select core_commerce_update_order_status('22222222-2222-4222-8222-222222222222','%s','new','confirmed')$q$,(:'placed'::jsonb->'order'->>'id')),'ORDER_CONFLICT');
rollback;
