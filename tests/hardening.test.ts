import assert from 'node:assert/strict';
import test from 'node:test';
import {CoreError, createOrder, defineRestaurantConfig, isRestaurantOpen, isUuid, publicOrder, quoteCheckout, sameCheckout, validateCatalog, validateCommerceProduct, type CheckoutInput, type Order} from '../packages/core/src/index.ts';
import {MemoryCoreRepository} from '../packages/adapters/src/memory.ts';
import {assertOrigin, clientAddress, errorResponse, readJson} from '../packages/adapters/src/http.ts';
import {ensurePaymentPreference, paymentPreferenceBody} from '../packages/adapters/src/mercadopago.ts';
import {receiptText} from '../packages/adapters/src/printnode.ts';
import {SupabaseCoreRepository} from '../packages/adapters/src/supabase.ts';
import {createCommerceSession, requireCommerceAdmin, verifyCommerceSession} from '../packages/adapters/src/commerce-auth.ts';
import {catalog, checkout, config, restaurantId} from './fixtures.ts';

process.env.NADAV_CORE_SESSION_SECRET = 'a-secure-test-secret-with-more-than-32-characters';
const clone = <T>(value: T): T => structuredClone(value);
const rejects = (fn: () => unknown, pattern?: RegExp) => assert.throws(fn, (error: unknown) => error instanceof CoreError && (!pattern || pattern.test(error.message)));
const key = '44444444-4444-4444-8444-444444444444';

// ------------------------------------------------------------------ domain: input validation
test('checkout rejects blank name, bad email, unknown mode and prototype-key payment methods', () => {
  const blank = clone(checkout); blank.customer.name = '   ';
  rejects(() => quoteCheckout(config, catalog, blank), /Nombre/);
  const email = clone(checkout); email.customer.email = 'not-an-email';
  rejects(() => quoteCheckout(config, catalog, email), /email/i);
  const mode = {...clone(checkout), mode: 'teleport'} as unknown as CheckoutInput;
  rejects(() => quoteCheckout(config, catalog, mode), /modalidad/i);
  for (const method of ['constructor', '__proto__', 'toString']) rejects(() => quoteCheckout(config, catalog, {...clone(checkout), paymentMethod: method} as unknown as CheckoutInput), /pago/i);
});

test('malformed carts fail with a CoreError instead of a TypeError', () => {
  rejects(() => quoteCheckout(config, catalog, {...clone(checkout), items: [null]} as unknown as CheckoutInput));
  rejects(() => quoteCheckout(config, catalog, {...clone(checkout), items: [{productId: 'burger', quantity: 1, selections: [null]}]} as unknown as CheckoutInput));
  rejects(() => quoteCheckout(config, catalog, {...clone(checkout), promotionCode: 42} as unknown as CheckoutInput));
  rejects(() => quoteCheckout(config, catalog, {...clone(checkout), customer: null} as unknown as CheckoutInput));
});

test('stock is checked on the total per product across cart lines', () => {
  const line = {productId: 'burger', quantity: 2, selections: [{groupId: 'size', optionId: 'small'}]};
  rejects(() => quoteCheckout(config, catalog, {...clone(checkout), items: [line, line]}), /Quedan 3/); // 2 + 2 > stock 3
  assert.equal(quoteCheckout(config, catalog, {...clone(checkout), items: [line]}).items.length, 1);
});

test('catalog validation reports bad shapes as CoreError and enforces new invariants', () => {
  const noOptions = clone(catalog) as any; delete noOptions.products[0].modifierGroups[0].options;
  rejects(() => validateCatalog(noOptions, restaurantId));
  const noProducts = clone(catalog) as any; noProducts.promotions[0].productIds = undefined;
  rejects(() => validateCatalog(noProducts, restaurantId));
  const dupGroup = clone(catalog); dupGroup.products[0].modifierGroups.push(clone(dupGroup.products[0].modifierGroups[0]));
  rejects(() => validateCatalog(dupGroup, restaurantId));
  const dupCode = clone(catalog); dupCode.promotions.push({...dupCode.promotions[0], id: 'ten-b', code: ' ten '});
  rejects(() => validateCatalog(dupCode, restaurantId), /repetidos/);
  const badDates = clone(catalog); badDates.promotions[0].startsAt = 'garbage';
  rejects(() => validateCatalog(badDates, restaurantId));
  const inverted = clone(catalog); inverted.promotions[0].startsAt = '2030-01-02T00:00:00Z'; inverted.promotions[0].endsAt = '2030-01-01T00:00:00Z';
  rejects(() => validateCatalog(inverted, restaurantId));
  const badImage = clone(catalog); badImage.products[0].image = '//evil.example/x.png';
  rejects(() => validateCatalog(badImage, restaurantId));
  const nullPromotion = clone(catalog) as any; nullPromotion.promotions = [null];
  rejects(() => validateCatalog(nullPromotion, restaurantId));
  const numericDate = clone(catalog) as any; numericDate.promotions[0].startsAt = 0;
  rejects(() => validateCatalog(numericDate, restaurantId));
  assert.doesNotThrow(() => validateCatalog(clone(catalog), restaurantId));
});

test('same opening and closing time means open all day', () => {
  const allDay = defineRestaurantConfig({...clone(config), hours: Object.fromEntries(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(day => [day, {open: true, from: '00:00', to: '00:00'}]))});
  assert.equal(isRestaurantOpen(allDay, new Date('2026-09-20T15:00:00Z')), true);
  assert.equal(isRestaurantOpen(allDay, new Date('2026-09-20T03:30:00Z')), true);
});

test('isUuid is strict', () => {
  assert.equal(isUuid(key), true);
  assert.equal(isUuid('-'.repeat(36)), false);
  assert.equal(isUuid('a'.repeat(36)), false);
  assert.equal(isUuid(undefined), false);
});

// ------------------------------------------------------------------ orders: replay detection and public view
const placed = (): Order => createOrder(restaurantId, 1001, key, checkout, quoteCheckout(config, catalog, checkout));

test('sameCheckout tells a retry from a reused idempotency key', () => {
  const order = placed();
  assert.equal(sameCheckout(order, clone(checkout)), true);
  assert.equal(sameCheckout(order, {...clone(checkout), paymentMethod: 'transfer'}), false);
  assert.equal(sameCheckout(order, {...clone(checkout), items: [{...checkout.items[0], quantity: 2}]}), false);
  assert.equal(sameCheckout(order, {...clone(checkout), items: [{...checkout.items[0], selections: [{groupId: 'size', optionId: 'small'}]}]}), false);
  assert.equal(sameCheckout(order, {...clone(checkout), customer: {...checkout.customer, name: 'Grace'}}), false);
  assert.equal(sameCheckout(order, {...clone(checkout), customer: {...checkout.customer, phone: '11 9999 9999'}}), false);
  assert.equal(sameCheckout(order, {...clone(checkout), customer: {...checkout.customer, email: 'other@example.com'}}), false);
  assert.equal(sameCheckout(order, {...clone(checkout), address: 'Otra dirección'}), false);
  assert.equal(sameCheckout(order, {...clone(checkout), deliveryZoneId: 'near'}), false);
  assert.equal(sameCheckout(order, {...clone(checkout), promotionCode: 'TEN'}), false);
  assert.equal(sameCheckout(order, {...clone(checkout), notes: 'Tocar timbre'}), false);
  assert.equal(sameCheckout(order, {...clone(checkout), items: [{...checkout.items[0], notes: 'Sin sal'}]}), false);
  assert.equal(sameCheckout(order, null), false);
});

test('public order view hides contact data and internals', () => {
  const view = JSON.stringify(publicOrder({...placed(), address: 'Calle Falsa 123', notes: 'timbre roto'}));
  for (const secret of ['221', 'ada@example.com', 'Calle Falsa', 'timbre', key, restaurantId]) assert.equal(view.includes(secret), false, secret);
  assert.match(view, /"name":"Ada"/);
});

test('memory repository mirrors SQL: replay, stock, cancel restores stock, typed not-found', async () => {
  const repository = new MemoryCoreRepository(config, clone(catalog));
  const command = {restaurantId, idempotencyKey: key, input: checkout, quote: quoteCheckout(config, catalog, checkout)};
  const first = await repository.placeOrder(command);
  assert.equal(first.created, true);
  assert.equal((await repository.placeOrder(command)).created, false);
  assert.equal((await repository.orderByIdempotencyKey(restaurantId, key))?.id, first.order.id);
  assert.equal((await repository.catalog(restaurantId))?.products[0].stock, 2);
  const tooMany = {...command, idempotencyKey: '55555555-5555-4555-8555-555555555555', quote: {...command.quote, items: [{...command.quote.items[0], quantity: 3}]}};
  await assert.rejects(repository.placeOrder(tooMany), (error: unknown) => error instanceof CoreError && error.status === 409);
  await repository.updateOrderStatus(restaurantId, first.order.id, 'cancelled');
  assert.equal((await repository.catalog(restaurantId))?.products[0].stock, 3);
  await assert.rejects(repository.updateOrderStatus(restaurantId, '66666666-6666-4666-8666-666666666666', 'confirmed'), (error: unknown) => error instanceof CoreError && error.status === 404);
});

// ------------------------------------------------------------------ http
test('admin-only origin rejects storefront origins; byte limit is real; timeouts become 504', async () => {
  process.env.APP_ORIGIN = 'https://core.example.com';
  process.env.NADAV_CORE_ALLOWED_ORIGINS = 'https://shop.example.com';
  const from = (origin: string, body = '{}') => new Request('https://core.example.com/api/v1/x', {method: 'POST', headers: {origin}, body});
  assert.doesNotThrow(() => assertOrigin(from('https://shop.example.com')));
  assert.throws(() => assertOrigin(from('https://shop.example.com'), {adminOnly: true}), (error: unknown) => error instanceof CoreError && error.status === 403);
  assert.doesNotThrow(() => assertOrigin(from('https://core.example.com'), {adminOnly: true}));
  const multibyte = JSON.stringify({a: 'ñ'.repeat(30_000)}); // ~30k characters but ~60k bytes
  await assert.rejects(readJson(from('https://shop.example.com', multibyte), 40_000), (error: unknown) => error instanceof CoreError && error.status === 413);
  const timeout = Object.assign(new Error('The operation was aborted due to timeout'), {name: 'TimeoutError'});
  assert.equal(errorResponse(timeout).status, 504);
  assert.equal(clientAddress(new Request('https://x.test', {headers: {'x-forwarded-for': ' 203.0.113.9, 10.0.0.1'}})), '203.0.113.9');
});

// ------------------------------------------------------------------ printing & payments
test('receipt prints the restaurant time zone, not the server one', () => {
  const order = {...placed(), createdAt: '2026-09-20T02:00:00.000Z'};
  assert.match(receiptText(order, 'Test Kitchen').split('\n')[2], /19\/9\/2026.*23:00:00/);
  assert.match(receiptText(order, 'Test Kitchen', 'UTC').split('\n')[2], /20\/9\/2026.*02:00:00/);
});

test('Mercado Pago sends the customer back to the storefront, not to a Core page that does not exist', () => {
  const input = {...checkout, paymentMethod: 'mercado_pago' as const};
  const order = createOrder(restaurantId, 1002, key, input, quoteCheckout(config, catalog, input));
  const body = paymentPreferenceBody(order, 'test-kitchen', 'https://core.example.com', 'https://burgers.example.com');
  assert.match(body.back_urls.success, /^https:\/\/burgers\.example\.com\/\?order=.+&restaurant=test-kitchen&payment=success$/);
  assert.equal(body.notification_url, 'https://core.example.com/api/v1/payments/mercadopago/webhook');
});

type Call = {method: string; url: string; body?: unknown};
function stubFetch(handler: (call: Call) => {status?: number; json: unknown}) {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  process.env.SUPABASE_URL = 'https://db.example.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const call = {method: init?.method ?? 'GET', url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined};
    calls.push(call);
    const result = handler(call);
    return new Response(JSON.stringify(result.json), {status: result.status ?? 200});
  }) as typeof fetch;
  return {calls, restore: () => { globalThis.fetch = original; }};
}
const mpOrder = () => createOrder(restaurantId, 1003, key, {...checkout, paymentMethod: 'mercado_pago'}, quoteCheckout(config, catalog, {...checkout, paymentMethod: 'mercado_pago'}));

test('a payment reservation left in "creating" by a dead request is released; a fresh one asks to retry', async () => {
  process.env.APP_ORIGIN = 'https://core.example.com';
  const stale = new Date(Date.now() - 10 * 60_000).toISOString();
  const fresh = new Date().toISOString();
  const order = mpOrder();
  const staleRun = stubFetch(call => call.method === 'GET' ? {json: [{status: 'creating', preference_id: null, init_point: null, updated_at: stale}]} : call.method === 'DELETE' ? {json: []} : {json: []}); // POST reserve -> [] (lost the race)
  try {
    await assert.rejects(ensurePaymentPreference(order, 'test-kitchen'), (error: unknown) => error instanceof CoreError && error.code === 'PAYMENT_IN_PROGRESS');
    assert.ok(staleRun.calls.some(call => call.method === 'DELETE' && /updated_at=lt\./.test(call.url)), 'stale reservation is deleted with a conditional filter');
  } finally { staleRun.restore(); }
  const freshRun = stubFetch(call => call.method === 'GET' ? {json: [{status: 'creating', preference_id: null, init_point: null, updated_at: fresh}]} : {json: []});
  try {
    await assert.rejects(ensurePaymentPreference(order, 'test-kitchen'), (error: unknown) => error instanceof CoreError && error.code === 'PAYMENT_IN_PROGRESS');
    assert.equal(freshRun.calls.some(call => call.method === 'DELETE'), false, 'a fresh reservation is never deleted');
  } finally { freshRun.restore(); }
});

test('database exceptions become stable client errors; order lookups never inject filters', async () => {
  const repository = new SupabaseCoreRepository();
  const command = {restaurantId, idempotencyKey: key, input: checkout, quote: quoteCheckout(config, catalog, checkout)};
  const oos = stubFetch(() => ({status: 400, json: {code: 'P0001', message: 'OUT_OF_STOCK', details: null, hint: null}}));
  try {
    await assert.rejects(repository.placeOrder(command), (error: unknown) => error instanceof CoreError && error.status === 409 && /stock/i.test(error.message));
  } finally { oos.restore(); }
  const drift = stubFetch(() => ({status: 400, json: {code: 'P0001', message: 'PRICE_MISMATCH'}}));
  try {
    await assert.rejects(repository.placeOrder(command), (error: unknown) => error instanceof CoreError && error.code === 'CATALOG_CHANGED');
  } finally { drift.restore(); }
  const lookup = stubFetch(() => ({json: []}));
  try {
    assert.equal(await repository.order(restaurantId, 'x&select=*&limit=1'), null);
    assert.equal(lookup.calls.length, 0, 'a non-UUID id never reaches the database');
  } finally { lookup.restore(); }
  const conflict = stubFetch(call => call.url.includes('rpc/core_update_order_status') ? {status: 400, json: {code: 'P0001', message: 'ORDER_CONFLICT'}} : {json: [{data: placed()}]});
  try {
    await assert.rejects(repository.updateOrderStatus(restaurantId, placed().id, 'confirmed'), (error: unknown) => error instanceof CoreError && error.status === 409);
    const rpcCall = conflict.calls.find(call => call.url.includes('rpc/core_update_order_status'));
    assert.deepEqual((rpcCall?.body as {p_expected: string}).p_expected, 'new');
  } finally { conflict.restore(); }
});

// ------------------------------------------------------------------ sessions & commerce
test('commerce sessions are signed, tenant-bound and role-checked', () => {
  const sub = '77777777-7777-4777-8777-777777777777';
  const request = (value: string) => new Request('https://core.example.com', {headers: {cookie: `other=1; nadav_commerce_admin=${value}`}});
  const editor = createCommerceSession({sub, restaurantId, role: 'editor'});
  assert.equal(verifyCommerceSession(editor)?.role, 'editor');
  assert.equal(verifyCommerceSession(`${editor}x`), null);
  assert.doesNotThrow(() => requireCommerceAdmin(request(editor), restaurantId, 'editor'));
  assert.throws(() => requireCommerceAdmin(request(editor), restaurantId, 'admin'), CoreError);
  assert.throws(() => requireCommerceAdmin(request(editor), '88888888-8888-4888-8888-888888888888', 'editor'), CoreError);
  assert.equal(verifyCommerceSession(createCommerceSession({sub, restaurantId, role: 'constructor' as never})), null);
});

test('commerce product validation matches database constraints', () => {
  const base = {id: '', slug: 'remera-siena', categoryId: '33333333-3333-4333-8333-333333333333', name: 'Remera', description: 'ok', price: 1000, images: ['/images/x.webp'], composition: '', care: '', active: true,
    variants: [{id: '', sku: null, color: 'Negro', colorValue: '#282522', size: 'S', stock: 5, active: true}]};
  assert.doesNotThrow(() => validateCommerceProduct(clone(base)));
  rejects(() => validateCommerceProduct({...clone(base), slug: 'Remera Siena'}));
  rejects(() => validateCommerceProduct({...clone(base), composition: 'x'.repeat(1001)}));
  rejects(() => validateCommerceProduct({...clone(base), variants: [{...base.variants[0], colorValue: 'red;background:url(x)'}]}));
  rejects(() => validateCommerceProduct({...clone(base), variants: [base.variants[0], {...base.variants[0], color: ' negro ', size: 's'}]}), /repetidas/);
  rejects(() => validateCommerceProduct({...clone(base), images: ['//evil.example/x.png']}));
});
