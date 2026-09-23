'use client';

import {money} from '../lib/catalog';
import type {CommerceOrder} from '@nadav/core';
import type {CartLine, CheckoutData} from './types';

export function OrderSuccess({number, lines, customer, order, onClose}: {number: string; lines: CartLine[]; customer: CheckoutData; order: CommerceOrder; onClose: () => void}) {
  return <div className="dialog-backdrop success-backdrop"><section className="success" role="dialog" aria-modal="true" aria-labelledby="success-title"><span className="success-mark">V</span><p className="eyebrow">Pedido recibido</p><h2 id="success-title">Gracias, {customer.name.split(' ')[0]}.</h2><p>Recibimos tu pedido <strong>#{number}</strong>. El comercio te va a escribir por WhatsApp con los datos de transferencia y confirmará el pago cuando lo reciba.</p><div className="success__summary"><span>{lines.reduce((sum, line) => sum + line.quantity, 0)} prendas</span><strong>{money(order.total)}</strong><small>{customer.fulfillment === 'delivery' ? `Envío a ${customer.city}` : 'Retiro por el estudio'} · Transferencia pendiente</small></div><button className="primary-button" type="button" onClick={onClose}>Volver a la colección</button></section></div>;
}
