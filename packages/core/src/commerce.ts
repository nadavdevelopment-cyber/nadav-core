import {randomUUID} from 'node:crypto';
import {invalid} from './errors.ts';

export type CommerceRole = 'owner' | 'admin' | 'editor';
export type CommerceOrderStatus = 'new' | 'confirmed' | 'packing' | 'shipped' | 'delivered' | 'cancelled';
export type CommercePaymentMethod = 'transfer' | 'card';
export type CommerceFulfillment = 'delivery' | 'pickup';
export type CommerceCategory = {id: string; slug: string; name: string; position: number; active: boolean};
export type CommerceVariant = {id: string; sku: string | null; color: string; colorValue: string | null; size: string; stock: number | null; active: boolean};
export type CommerceProduct = {id: string; slug: string; categoryId: string; name: string; description: string; price: number; images: string[]; composition: string; care: string; active: boolean; variants: CommerceVariant[]};
export type CommerceContent = {heroEyebrow: string; heroTitle: string; heroEmphasis: string; heroDescription: string; studioCopy: string; shippingNote: string};
export type CommerceSettings = {storeName: string; currency: 'ARS'; pickupEnabled: boolean; deliveryEnabled: boolean; deliveryFee: number};
export type CommerceCatalog = {restaurantId: string; categories: CommerceCategory[]; products: CommerceProduct[]; content: CommerceContent; settings: CommerceSettings};
export type CommerceCartItemInput = {productId: string; variantId: string; quantity: number};
export type CommerceCheckoutInput = {items: CommerceCartItemInput[]; customer: {name: string; email: string; phone?: string}; fulfillment: CommerceFulfillment; address?: string; city?: string; paymentMethod: CommercePaymentMethod};
export type CommerceOrderItem = {productId: string; variantId: string; name: string; image: string | null; color: string; size: string; unitPrice: number; quantity: number; lineTotal: number};
export type CommerceQuote = {items: CommerceOrderItem[]; subtotal: number; deliveryFee: number; total: number; currency: 'ARS'};
export type CommerceOrder = CommerceQuote & {id: string; restaurantId: string; number: number; idempotencyKey: string; customer: CommerceCheckoutInput['customer']; fulfillment: CommerceFulfillment; address: string; city: string; paymentMethod: CommercePaymentMethod; paymentStatus: 'pending' | 'approved' | 'rejected' | 'refunded'; status: CommerceOrderStatus; createdAt: string};
export type CommerceCatalogResponse = {store: {slug: string; name: string}; catalog: CommerceCatalog};

const text = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
const amount = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 1_000_000_000;

export function validateCommerceCheckout(input: CommerceCheckoutInput) {
  if (!input || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 40) throw invalid('El carrito no es válido.');
  if (!text(input.customer?.name, 120) || !text(input.customer?.email, 160) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customer.email.trim())) throw invalid('Completá tus datos de contacto.');
  if (input.customer.phone !== undefined && !text(input.customer.phone, 40)) throw invalid('El teléfono no es válido.');
  if (!['delivery', 'pickup'].includes(input.fulfillment) || !['transfer', 'card'].includes(input.paymentMethod)) throw invalid('La forma de compra no es válida.');
  if (input.fulfillment === 'delivery' && (!text(input.address, 180) || !text(input.city, 100))) throw invalid('Completá la dirección de envío.');
  const ids = new Set<string>();
  for (const line of input.items) {
    if (!text(line.productId, 90) || !text(line.variantId, 90) || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) throw invalid('Hay un producto inválido en el carrito.');
    const key = `${line.productId}:${line.variantId}`;
    if (ids.has(key)) throw invalid('Hay productos duplicados en el carrito.');
    ids.add(key);
  }
  return structuredClone(input);
}

export function quoteCommerceCheckout(catalog: CommerceCatalog, rawInput: CommerceCheckoutInput): CommerceQuote {
  const input = validateCommerceCheckout(rawInput);
  const products = new Map(catalog.products.filter(product => product.active).map(product => [product.id, product]));
  const items = input.items.map(line => {
    const product = products.get(line.productId);
    const variant = product?.variants.find(row => row.id === line.variantId && row.active);
    if (!product || !variant) throw invalid('Una prenda ya no está disponible.');
    if (variant.stock !== null && variant.stock < line.quantity) throw invalid(`No hay stock suficiente de ${product.name}.`);
    return {productId: product.id, variantId: variant.id, name: product.name, image: product.images[0] ?? null, color: variant.color, size: variant.size, unitPrice: product.price, quantity: line.quantity, lineTotal: product.price * line.quantity};
  });
  const subtotal = items.reduce((sum, line) => sum + line.lineTotal, 0);
  const deliveryFee = input.fulfillment === 'delivery' ? catalog.settings.deliveryFee : 0;
  if (input.fulfillment === 'delivery' && !catalog.settings.deliveryEnabled) throw invalid('Los envíos no están disponibles.');
  if (input.fulfillment === 'pickup' && !catalog.settings.pickupEnabled) throw invalid('El retiro no está disponible.');
  return {items, subtotal, deliveryFee, total: subtotal + deliveryFee, currency: 'ARS'};
}

export function createCommerceOrder(restaurantId: string, number: number, idempotencyKey: string, input: CommerceCheckoutInput, quote: CommerceQuote, now = new Date()): CommerceOrder {
  if (!/^[0-9a-f-]{36}$/i.test(restaurantId) || !/^[0-9a-f-]{36}$/i.test(idempotencyKey)) throw invalid('Identificador inválido.');
  return {id: randomUUID(), restaurantId, number, idempotencyKey, ...quote, customer: {name: input.customer.name.trim(), email: input.customer.email.trim().toLowerCase(), ...(input.customer.phone ? {phone: input.customer.phone.trim()} : {})}, fulfillment: input.fulfillment, address: (input.address ?? '').trim(), city: (input.city ?? '').trim(), paymentMethod: input.paymentMethod, paymentStatus: 'pending', status: 'new', createdAt: now.toISOString()};
}

const transitions: Record<CommerceOrderStatus, CommerceOrderStatus[]> = {new: ['confirmed', 'cancelled'], confirmed: ['packing', 'cancelled'], packing: ['shipped', 'delivered', 'cancelled'], shipped: ['delivered'], delivered: [], cancelled: []};
export function transitionCommerceOrder(order: CommerceOrder, status: CommerceOrderStatus) {
  if (!transitions[order.status]?.includes(status)) throw invalid('El cambio de estado no está permitido.');
  return {...order, status};
}

export function validateCommerceProduct(value: CommerceProduct) {
  if (!value || !text(value.slug, 80) || !text(value.name, 160) || !text(value.description, 2_000) || !text(value.categoryId, 90) || !amount(value.price) || value.price === 0 || !Array.isArray(value.images) || value.images.length > 8 || !Array.isArray(value.variants) || value.variants.length < 1 || value.variants.length > 100) throw invalid('Los datos de la prenda no son válidos.');
  if (!value.images.every(image => text(image, 2_000) && (/^\//.test(image) || /^https:\/\//.test(image)))) throw invalid('Una imagen no es válida.');
  for (const variant of value.variants) if (!text(variant.color, 80) || !text(variant.size, 40) || (variant.stock !== null && (!Number.isInteger(variant.stock) || variant.stock < 0 || variant.stock > 1_000_000))) throw invalid('Una variante no es válida.');
  return structuredClone(value);
}
