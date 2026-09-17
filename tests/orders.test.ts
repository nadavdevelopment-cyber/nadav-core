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
