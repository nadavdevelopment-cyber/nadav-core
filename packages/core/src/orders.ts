import {randomUUID} from 'node:crypto';
import {invalid} from './errors.ts';
import type {CheckoutInput, Order, OrderStatus, Quote} from './types.ts';

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
  if (!/^[0-9a-f-]{36}$/i.test(restaurantId) || !/^[0-9a-f-]{36}$/i.test(idempotencyKey)) throw invalid('Identificador inválido.');
  return {...quote, id: randomUUID(), restaurantId, number, idempotencyKey, customer: {...input.customer, name: input.customer.name.trim(), phone: input.customer.phone.replace(/\D/g, '')}, mode: input.mode, paymentMethod: input.paymentMethod, paymentStatus: 'pending', status: 'new', address: (input.address ?? '').trim(), deliveryZoneId: input.deliveryZoneId, promotionCode: input.promotionCode?.trim().toUpperCase(), notes: (input.notes ?? '').trim(), createdAt: now.toISOString()};
}

export function canTransition(from: OrderStatus, to: OrderStatus, mode: Order['mode']) {
  return transitions[from].includes(to) && !(to === 'on_the_way' && mode !== 'delivery');
}

export function transitionOrder(order: Order, to: OrderStatus) {
  if (!canTransition(order.status, to, order.mode)) throw invalid('El cambio de estado no está permitido.');
  return {...order, status: to};
}
