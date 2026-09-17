import assert from 'node:assert/strict';
import test from 'node:test';
import {quoteCheckout, validateCatalog} from '../packages/core/src/index.ts';
import {catalog, checkout, config} from './fixtures.ts';

test('server catalog determines product and modifier prices', () => {
  const quote = quoteCheckout(config, catalog, {...checkout, items: [{...checkout.items[0], selections: [{groupId: 'size', optionId: 'large'}]}]});
  assert.equal(quote.subtotal, 1300);
  assert.equal(quote.total, 1300);
  assert.equal(quote.items[0].unitPrice, 1300);
});

test('client cannot submit unknown modifiers or skip required groups', () => {
  assert.throws(() => quoteCheckout(config, catalog, {...checkout, items: [{...checkout.items[0], selections: []}]}), /Tamaño/);
  assert.throws(() => quoteCheckout(config, catalog, {...checkout, items: [{...checkout.items[0], selections: [{groupId: 'size', optionId: 'hack'}]}]}), /opción/);
});

test('promotion and promotional product price are calculated server-side', () => {
  const quote = quoteCheckout(config, catalog, {...checkout, promotionCode: 'ten', items: [{productId: 'fries', quantity: 2, selections: []}]});
  assert.equal(quote.subtotal, 1200);
  assert.equal(quote.discount, 120);
  assert.equal(quote.total, 1080);
});

test('stock is enforced without trusting cart values', () => {
  assert.throws(() => quoteCheckout(config, catalog, {...checkout, items: [{...checkout.items[0], quantity: 4}]}), /Quedan 3/);
});

test('delivery requires address and valid zone, then uses server fee', () => {
  assert.throws(() => quoteCheckout(config, catalog, {...checkout, mode: 'delivery'}), /dirección/i);
  assert.throws(() => quoteCheckout(config, catalog, {...checkout, mode: 'delivery', address: 'Calle 1', deliveryZoneId: 'fake'}), /zona/i);
  const quote = quoteCheckout(config, catalog, {...checkout, mode: 'delivery', address: 'Calle 1', deliveryZoneId: 'near'});
  assert.equal(quote.deliveryFee, 800);
  assert.equal(quote.total, 2100);
});

test('unsupported payment methods and disabled features fail closed', () => {
  const disabled = {...config, features: {...config.features, mercadoPago: false}, payments: {...config.payments, mercadoPago: false}};
  assert.throws(() => quoteCheckout(disabled, catalog, {...checkout, paymentMethod: 'mercado_pago'}), /no está disponible/i);
});

test('catalog validation rejects cross-references and duplicate identifiers', () => {
  assert.equal(validateCatalog(catalog, catalog.restaurantId).products.length, 2);
  assert.throws(() => validateCatalog({...catalog, products: [{...catalog.products[0], categoryId: 'other'}]}, catalog.restaurantId), /Productos/);
  assert.throws(() => validateCatalog({...catalog, categories: [...catalog.categories, catalog.categories[0]]}, catalog.restaurantId), /duplicados/);
});
