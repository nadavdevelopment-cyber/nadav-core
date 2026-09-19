'use client';

import {money} from '../lib/catalog';
import type {CartLine, CheckoutData} from './types';

export function OrderSuccess({number, lines, customer, onClose}: {number: string; lines: CartLine[]; customer: CheckoutData; onClose: () => void}) {
  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const shipping = customer.fulfillment === 'delivery' ? 4500 : 0;
  return <div className="dialog-backdrop success-backdrop"><section className="success" role="dialog" aria-modal="true" aria-labelledby="success-title"><span className="success-mark">V</span><p className="eyebrow">Pedido confirmado</p><h2 id="success-title">Gracias, {customer.name.split(' ')[0]}.</h2><p>Recibimos tu pedido <strong>#{number}</strong>. Te vamos a escribir por WhatsApp para acompañarte hasta que esté en tus manos.</p><div className="success__summary"><span>{lines.reduce((sum, line) => sum + line.quantity, 0)} prendas</span><strong>{money(subtotal + shipping)}</strong><small>{customer.fulfillment === 'delivery' ? `Envío a ${customer.city}` : 'Retiro por el estudio'} · {customer.payment === 'transfer' ? 'Transferencia' : 'Tarjeta demo'}</small></div><button className="primary-button" type="button" onClick={onClose}>Volver a la colección</button></section></div>;
}
