import {randomUUID} from 'node:crypto';
import {invalid} from './errors.ts';
import {isUuid} from './ids.ts';
import type {CheckoutInput, Order, OrderStatus, PublicOrder, Quote} from './types.ts';

const transitions: Record<OrderStatus, OrderStatus[]> = {
  new: ['confirmed', 'preparing', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['on_the_way', 'delivered', 'cancelled'],
  on_the_way: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: []
};

export function createOrder(restaurantId: string, number: number, idempotencyKey: string, input: CheckoutInput, quote: Quote, now = new Date()): Order {
  if (!isUuid(restaurantId) || !isUuid(idempotencyKey)) throw invalid('Identificador inválido.');
  return {...quote, id: randomUUID(), restaurantId, number, idempotencyKey, customer: {...input.customer, name: input.customer.name.trim(), phone: input.customer.phone.replace(/\D/g, '')}, mode: input.mode, paymentMethod: input.paymentMethod, paymentStatus: 'pending', status: 'new', address: (input.address ?? '').trim(), deliveryZoneId: input.deliveryZoneId, promotionCode: input.promotionCode?.trim().toUpperCase(), notes: (input.notes ?? '').trim(), createdAt: now.toISOString()};
}

export function canTransition(from: OrderStatus, to: OrderStatus, mode: Order['mode']) {
  return transitions[from].includes(to) && !(to === 'on_the_way' && mode !== 'delivery');
}

export function transitionOrder(order: Order, to: OrderStatus) {
  if (!canTransition(order.status, to, order.mode)) throw invalid('El cambio de estado no está permitido.');
  return {...order, status: to};
}

const normalizedText = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const normalizedPhone = (value: unknown) => normalizedText(value).replace(/\D/g, '');
const lineSignature = (productId: unknown, quantity: unknown, options: unknown[], notes: unknown) => `${String(productId)}x${String(quantity)}[${options.map(option => `${(option as {groupId?: unknown})?.groupId}:${(option as {optionId?: unknown})?.optionId}`).sort().join(',')}]#${normalizedText(notes)}`;

/**
 * True when a retried checkout is the same request that originally created `order`.
 * Compare the complete normalized checkout, not only the cart: an Idempotency-Key reused
 * with another customer, address, zone, promotion or note must be rejected.
 */
export function sameCheckout(order: Order, input: unknown) {
  if (!input || typeof input !== 'object') return false;
  const checkout = input as Partial<CheckoutInput>;
  const customer = checkout.customer;
  if (!customer || typeof customer !== 'object' || checkout.mode !== order.mode || checkout.paymentMethod !== order.paymentMethod || !Array.isArray(checkout.items)) return false;
  if (normalizedText(customer.name) !== order.customer.name || normalizedPhone(customer.phone) !== order.customer.phone || normalizedText(customer.email) !== normalizedText(order.customer.email)) return false;
  if (normalizedText(checkout.address) !== normalizedText(order.address) || normalizedText(checkout.deliveryZoneId) !== normalizedText(order.deliveryZoneId) || normalizedText(checkout.promotionCode).toUpperCase() !== normalizedText(order.promotionCode).toUpperCase() || normalizedText(checkout.notes) !== normalizedText(order.notes)) return false;
  const requested = checkout.items.map(item => lineSignature(item?.productId, item?.quantity, Array.isArray(item?.selections) ? item.selections : [], item?.notes)).sort();
  const stored = order.items.map(item => lineSignature(item.productId, item.quantity, item.modifiers, item.notes)).sort();
  return requested.length === stored.length && requested.every((line, index) => line === stored[index]);
}

export function publicOrder(order: Order): PublicOrder {
  return {
    id: order.id, number: order.number, status: order.status, paymentStatus: order.paymentStatus, paymentMethod: order.paymentMethod, mode: order.mode,
    subtotal: order.subtotal, discount: order.discount, deliveryFee: order.deliveryFee, total: order.total, currency: order.currency, createdAt: order.createdAt,
    customer: {name: order.customer.name},
    items: order.items.map(item => ({name: item.name, quantity: item.quantity, lineTotal: item.lineTotal, modifiers: item.modifiers.map(modifier => ({groupName: modifier.groupName, name: modifier.name}))}))
  };
}
