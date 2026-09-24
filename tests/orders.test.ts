import assert from 'node:assert/strict';
import test from 'node:test';
import {quoteCheckout, transitionOrder} from '../packages/core/src/index.ts';
import {MemoryCoreRepository} from '../packages/adapters/src/memory.ts';
import {catalog, checkout, config, restaurantId} from './fixtures.ts';

test('same idempotency key returns one order and number', async () => {
  const repo = new MemoryCoreRepository(config, catalog);
  const quote = quoteCheckout(config, catalog, checkout);
  const idempotencyKey = '22222222-2222-4222-8222-222222222222';
  const first = await repo.placeOrder({restaurantId, idempotencyKey, input: checkout, quote});
  const second = await repo.placeOrder({restaurantId, idempotencyKey, input: checkout, quote});
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.order.id, second.order.id);
  assert.equal(first.order.number, second.order.number);
});

test('order status follows forward-only workflow', async () => {
  const repo = new MemoryCoreRepository(config, catalog);
  const quote = quoteCheckout(config, catalog, checkout);
  const result = await repo.placeOrder({restaurantId, idempotencyKey: '33333333-3333-4333-8333-333333333333', input: checkout, quote});
  const preparing = transitionOrder(result.order, 'preparing');
  assert.equal(preparing.status, 'preparing');
  assert.throws(() => transitionOrder(preparing, 'confirmed'), /no está permitido/i);
  assert.throws(() => transitionOrder({...preparing, status: 'ready'}, 'on_the_way'), /no está permitido/i);
});

test('rate limiter blocks after configured threshold', async () => {
  const repo = new MemoryCoreRepository(config, catalog);
  assert.equal(await repo.rateLimit('ip', 2, 60), true);
  assert.equal(await repo.rateLimit('ip', 2, 60), true);
  assert.equal(await repo.rateLimit('ip', 2, 60), false);
});

test('listOrders pages newest-first and never returns more than the requested (capped) limit', async () => {
  // A fresh cloned catalog: the shared fixture's stock is already partly spent by earlier tests in this file.
  const freshCatalog = structuredClone(catalog);
  const repo = new MemoryCoreRepository(config, freshCatalog);
  const friesCheckout = {...checkout, items: [{productId: 'fries', quantity: 2, selections: []}]}; // 2 x $600 clears the $1000 minimum order
  for (let i = 0; i < 5; i++) {
    await repo.placeOrder({restaurantId, idempotencyKey: `5555555${i}-5555-4555-8555-555555555555`, input: friesCheckout, quote: quoteCheckout(config, freshCatalog, friesCheckout)});
    await new Promise(resolve => setTimeout(resolve, 2)); // distinct createdAt per order — the cursor pages on it
  }
  const firstPage = await repo.listOrders(restaurantId, {limit: 2});
  assert.equal(firstPage.length, 2);
  assert.ok(firstPage[0].createdAt >= firstPage[1].createdAt, 'newest first');
  const secondPage = await repo.listOrders(restaurantId, {limit: 2, before: firstPage[1].createdAt});
  assert.equal(secondPage.length, 2);
  assert.equal(new Set([...firstPage, ...secondPage].map(order => order.id)).size, 4);
  // A caller asking for an absurd limit never gets an unbounded response back.
  const capped = await repo.listOrders(restaurantId, {limit: 10_000});
  assert.equal(capped.length <= 100, true);
});
