'use client';

import {useEffect, useState} from 'react';
import {money} from '../lib/catalog';
import type {CartLine, CheckoutData} from './types';

const initial: CheckoutData = {name: '', email: '', phone: '', fulfillment: 'delivery', address: '', city: '', payment: 'transfer'};

export function CheckoutDialog({lines, onClose, onComplete}: {lines: CartLine[]; onClose: () => void; onComplete: (data: CheckoutData) => void}) {
  const [data, setData] = useState(initial);
  const [step, setStep] = useState<1 | 2>(1);
  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const shipping = data.fulfillment === 'delivery' ? 4500 : 0;
  const set = <K extends keyof CheckoutData>(key: K, value: CheckoutData[K]) => setData(current => ({...current, [key]: value}));

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const contactValid = Boolean(data.name && data.email && data.phone && (data.fulfillment === 'pickup' || (data.address && data.city)));
  return <div className="dialog-backdrop checkout-backdrop">
    <section className="checkout" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <header><div><p className="eyebrow">Paso {step} de 2</p><h2 id="checkout-title">Finalizar compra</h2></div><button className="close-button" type="button" onClick={onClose} aria-label="Cerrar checkout">×</button></header>
      <div className="checkout__content">
        <div className="checkout__form">
          {step === 1 ? <>
            <section><h3>Datos personales</h3><div className="form-grid"><label>Nombre y apellido<input value={data.name} onChange={event => set('name', event.target.value)} autoComplete="name" required/></label><label>Email<input type="email" value={data.email} onChange={event => set('email', event.target.value)} autoComplete="email" required/></label><label className="full">WhatsApp<input type="tel" value={data.phone} onChange={event => set('phone', event.target.value)} autoComplete="tel" required/></label></div></section>
            <section><h3>Entrega</h3><div className="choice-grid"><label className={data.fulfillment === 'delivery' ? 'selected' : ''}><input type="radio" name="fulfillment" checked={data.fulfillment === 'delivery'} onChange={() => set('fulfillment', 'delivery')}/><strong>Envío a domicilio</strong><small>Se despacha en 2 a 4 días hábiles</small></label><label className={data.fulfillment === 'pickup' ? 'selected' : ''}><input type="radio" name="fulfillment" checked={data.fulfillment === 'pickup'} onChange={() => set('fulfillment', 'pickup')}/><strong>Retiro por el estudio</strong><small>Coordinamos el día por WhatsApp</small></label></div>{data.fulfillment === 'delivery' && <div className="form-grid address-fields"><label>Dirección<input value={data.address} onChange={event => set('address', event.target.value)} autoComplete="street-address" required/></label><label>Localidad<input value={data.city} onChange={event => set('city', event.target.value)} autoComplete="address-level2" required/></label></div>}</section>
          </> : <section><h3>¿Cómo querés pagar?</h3><div className="choice-grid payment-choices"><label className={data.payment === 'transfer' ? 'selected' : ''}><input type="radio" name="payment" checked={data.payment === 'transfer'} onChange={() => set('payment', 'transfer')}/><strong>Transferencia</strong><small>Te mostramos los datos al confirmar</small></label><label className={data.payment === 'card' ? 'selected' : ''}><input type="radio" name="payment" checked={data.payment === 'card'} onChange={() => set('payment', 'card')}/><strong>Tarjeta</strong><small>Pago de demostración, sin cobro real</small></label></div><div className="studio-note"><span>V</span><p>Preparamos tu pedido a mano desde nuestro estudio. Cuando esté listo, te avisamos.</p></div></section>}
        </div>
        <aside className="order-summary"><h3>Tu pedido</h3>{lines.map(line => <div className="summary-line" key={line.key}><span>{line.quantity} × {line.product.name}<small>{line.color} · {line.size}</small></span><strong>{money(line.product.price * line.quantity)}</strong></div>)}<div className="summary-total"><p><span>Subtotal</span><strong>{money(subtotal)}</strong></p><p><span>Envío</span><strong>{shipping ? money(shipping) : 'Sin cargo'}</strong></p><p><span>Total</span><strong>{money(subtotal + shipping)}</strong></p></div></aside>
      </div>
      <footer>{step === 2 && <button className="text-button" type="button" onClick={() => setStep(1)}>← Volver</button>}<button className="primary-button" type="button" disabled={step === 1 && !contactValid} onClick={() => step === 1 ? setStep(2) : onComplete(data)}>{step === 1 ? 'Continuar al pago' : 'Confirmar pedido'}</button></footer>
    </section>
  </div>;
}
