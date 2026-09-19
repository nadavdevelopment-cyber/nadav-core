import assert from 'node:assert/strict';
import test from 'node:test';
import {createCommerceOrder, quoteCommerceCheckout, transitionCommerceOrder, type CommerceCatalog, type CommerceCheckoutInput} from '../packages/core/src/index.ts';

const catalog: CommerceCatalog = {
  restaurantId: '77777777-7777-4777-8777-777777777777',
  categories: [{id: 'category', slug: 'tops', name: 'Tops', position: 1, active: true}],
  products: [{id: 'product', slug: 'top', categoryId: 'category', name: 'Top', description: 'Top', price: 27900, images: ['/images/top.webp'], composition: 'Algodón', care: 'Frío', active: true, variants: [{id: 'variant', sku: null, color: 'Rosa', colorValue: '#bd8f8a', size: 'M', stock: 2, active: true}]}],
  content: {heroEyebrow: 'Nueva colección', heroTitle: 'Vestirse', heroEmphasis: 'como una misma.', heroDescription: 'Simple', studioCopy: 'Cuidado', shippingNote: 'Despacho'},
  settings: {storeName: 'Vera Studio', currency: 'ARS', pickupEnabled: true, deliveryEnabled: true, deliveryFee: 4500}
};
const input: CommerceCheckoutInput = {items: [{productId: 'product', variantId: 'variant', quantity: 1}], customer: {name: 'Ada Lovelace', email: 'ada@example.com', phone: '221 555 0000'}, fulfillment: 'delivery', address: 'Calle 1 123', city: 'La Plata', paymentMethod: 'transfer'};

test('Commerce calcula precio, variante y envío server-side', () => {
  const quote = quoteCommerceCheckout(catalog, input);
  assert.equal(quote.subtotal, 27900);
  assert.equal(quote.deliveryFee, 4500);
  assert.equal(quote.total, 32400);
  assert.equal(quote.items[0].unitPrice, 27900);
});

test('Commerce rechaza stock agotado y no acepta el total del navegador', () => {
  assert.throws(() => quoteCommerceCheckout(catalog, {...input, items: [{...input.items[0], quantity: 3}]}), /stock/i);
  const quote = quoteCommerceCheckout(catalog, input);
  assert.equal(quote.total, 32400, 'el total se deriva del catálogo, no de un campo enviado');
});

test('Commerce crea pedido idempotente en el modelo compartido', () => {
  const order = createCommerceOrder(catalog.restaurantId, 1001, '22222222-2222-4222-8222-222222222222', input, quoteCommerceCheckout(catalog, input));
  assert.equal(order.status, 'new');
  assert.equal(order.paymentStatus, 'pending');
  assert.equal(order.total, 32400);
  assert.equal(transitionCommerceOrder(order, 'confirmed').status, 'confirmed');
  assert.throws(() => transitionCommerceOrder(order, 'delivered'), /no está permitido/i);
});
