import assert from 'node:assert/strict';
import test from 'node:test';
import {createOrder, quoteCheckout} from '../packages/core/src/index.ts';
import {openSecret, sealSecret} from '../packages/adapters/src/crypto.ts';
import {receiptPdf, receiptText} from '../packages/adapters/src/printnode.ts';
import {catalog, checkout, config, restaurantId} from './fixtures.ts';

process.env.PRINTNODE_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

test('PrintNode API key is AES-GCM encrypted and bound to restaurant', () => {
  const sealed = sealSecret('private-api-key-123456789', restaurantId, 'printnode');
  assert.equal(sealed.includes('private-api-key'), false);
  assert.equal(openSecret(sealed, restaurantId, 'printnode'), 'private-api-key-123456789');
  assert.throws(() => openSecret(sealed, '99999999-9999-4999-8999-999999999999', 'printnode'));
});

test('receipt contains operational and payment details', () => {
  const quote = quoteCheckout(config, catalog, checkout);
  const order = createOrder(restaurantId, 1001, '55555555-5555-4555-8555-555555555555', checkout, quote);
  const receipt = receiptText(order, 'Test Kitchen');
  for (const value of ['Test Kitchen', 'PEDIDO #1001', 'Ada', 'Burger', 'Subtotal', 'TOTAL', 'cash']) assert.match(receipt, new RegExp(value));
  assert.match(Buffer.from(receiptPdf(receipt, '58'), 'base64').toString('latin1'), /^%PDF-1\.4/);
});
