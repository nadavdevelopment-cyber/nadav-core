import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import test from 'node:test';
import {createOrder, quoteCheckout} from '../packages/core/src/index.ts';
import {parsePaymentReference, paymentPreferenceBody, paymentReference} from '../packages/adapters/src/mercadopago.ts';
import {verifyMercadoPagoSignature} from '../packages/adapters/src/crypto.ts';
import {catalog, checkout, config, restaurantId} from './fixtures.ts';

test('Mercado Pago preference uses persisted server total and reference', () => {
  const input = {...checkout, paymentMethod: 'mercado_pago' as const};
  const order = createOrder(restaurantId, 1001, '44444444-4444-4444-8444-444444444444', input, quoteCheckout(config, catalog, input));
  const body = paymentPreferenceBody(order, 'test-kitchen', 'https://core.example.com');
  assert.equal(body.items[0].unit_price, 1300);
  assert.equal(body.items[0].currency_id, 'ARS');
  assert.equal(body.external_reference, paymentReference(restaurantId, order.id));
  assert.deepEqual(parsePaymentReference(body.external_reference), {restaurantId, orderId: order.id});
  assert.equal('access_token' in body, false);
});

test('Mercado Pago webhook signature is mandatory and constant-time verified', () => {
  const secret = 'webhook-secret';
  const id = '123456';
  const requestId = 'request-1';
  const ts = '1790000000';
  const hash = createHmac('sha256', secret).update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex');
  assert.equal(verifyMercadoPagoSignature(`ts=${ts},v1=${hash}`, requestId, id, secret), true);
  assert.equal(verifyMercadoPagoSignature(null, requestId, id, secret), false);
  assert.equal(verifyMercadoPagoSignature(`ts=${ts},v1=${'0'.repeat(64)}`, requestId, id, secret), false);
});
