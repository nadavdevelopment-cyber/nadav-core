'use client';

import type {Order} from '@nadav/core';
import {useDialogFocus} from './useDialogFocus';

const money = (value: number) => new Intl.NumberFormat('es-AR', {style: 'currency', currency: 'ARS', maximumFractionDigits: 0}).format(value);
const paymentName = {cash: 'Efectivo', transfer: 'Transferencia', mercado_pago: 'Mercado Pago'} as const;

export function OrderSuccess({order, paymentUrl, onDone}: {order: Order; paymentUrl?: string; onDone: () => void}) {
  const dialogRef = useDialogFocus<HTMLElement>(onDone);
  return <div className="dialog-layer dialog-layer--success">
    <section className="order-success" role="dialog" aria-modal="true" aria-labelledby="success-title" ref={dialogRef} tabIndex={-1}>
      <span className="sheet-handle" aria-hidden="true"/>
      <div className="success-stamp" aria-hidden="true">✓</div>
      <span className="eyebrow">PEDIDO RECIBIDO</span>
      <h2 id="success-title">Listo, ya está en marcha.</h2>
      <p>Gracias por elegir BurgerHouse. Guardá este número para seguir tu pedido.</p>
      <div className="order-number"><span>PEDIDO</span><strong>#{order.number}</strong><small>Estado: recibido</small></div>
      <div className="success-summary">
        {order.items.map(item => <div key={`${item.productId}-${item.modifiers.map(modifier => modifier.optionId).join('-')}`}><span>{item.quantity}× {item.name}<small>{item.modifiers.map(modifier => modifier.name).join(' · ')}</small></span><strong>{money(item.lineTotal)}</strong></div>)}
        {order.discount ? <div><span>Descuento</span><strong>− {money(order.discount)}</strong></div> : null}
        {order.deliveryFee ? <div><span>Envío</span><strong>{money(order.deliveryFee)}</strong></div> : null}
        <div className="success-summary__total"><span>Total</span><strong>{money(order.total)}</strong></div>
      </div>
      <dl className="success-meta">
        <div><dt>Modalidad</dt><dd>{order.mode === 'delivery' ? `Delivery · ${order.address}` : 'Retiro por el local'}</dd></div>
        <div><dt>Pago</dt><dd>{paymentName[order.paymentMethod]} · {order.paymentStatus === 'approved' ? 'Aprobado' : 'Pendiente'}</dd></div>
      </dl>
      {paymentUrl ? <a className="primary-button primary-button--wide" href={paymentUrl}>PAGAR CON MERCADO PAGO</a> : null}
      <button className={paymentUrl ? 'secondary-button secondary-button--wide' : 'primary-button primary-button--wide'} type="button" onClick={onDone}>VOLVER AL MENÚ</button>
    </section>
  </div>;
}
