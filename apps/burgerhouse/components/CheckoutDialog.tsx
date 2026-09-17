'use client';

import {useMemo, useState} from 'react';
import type {CatalogResponse, CheckoutInput, PaymentMethod} from '@nadav/core';
import type {CartLine} from './storefront-types';
import {lineLabel, unitPrice} from './storefront-types';
import {useDialogFocus} from './useDialogFocus';

const money = (value: number) => new Intl.NumberFormat('es-AR', {style: 'currency', currency: 'ARS', maximumFractionDigits: 0}).format(value);

export function CheckoutDialog({menu, lines, busy, error, onBack, onClose, onSubmit}: {menu: CatalogResponse; lines: CartLine[]; busy: boolean; error: string; onBack: () => void; onClose: () => void; onSubmit: (checkout: CheckoutInput) => Promise<void>}) {
  const initialMode = menu.restaurant.features.pickup ? 'pickup' : 'delivery';
  const [mode, setMode] = useState<'pickup' | 'delivery'>(initialMode);
  const payments = useMemo(() => [
    menu.payments.mercadoPago && menu.restaurant.features.mercadoPago ? {value: 'mercado_pago' as const, label: 'Mercado Pago', detail: 'Tarjetas y dinero en cuenta'} : null,
    menu.payments.cash && menu.restaurant.features.cash ? {value: 'cash' as const, label: 'Efectivo', detail: 'Pagás al recibir o retirar'} : null,
    menu.payments.transfer && menu.restaurant.features.transfer ? {value: 'transfer' as const, label: 'Transferencia', detail: 'Te pasamos los datos'} : null
  ].filter((option): option is {value: PaymentMethod; label: string; detail: string} => option !== null), [menu]);
  const [payment, setPayment] = useState<PaymentMethod>(payments[0]?.value ?? 'cash');
  const subtotal = lines.reduce((sum, line) => sum + unitPrice(line) * line.quantity, 0);
  const dialogRef = useDialogFocus<HTMLElement>(onClose, !busy);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const checkout: CheckoutInput = {
      items: lines.map(line => ({productId: line.product.id, quantity: line.quantity, selections: line.selections, notes: line.notes})),
      customer: {name: String(form.get('name') ?? ''), phone: String(form.get('phone') ?? ''), email: String(form.get('email') ?? '')},
      mode,
      paymentMethod: payment,
      address: mode === 'delivery' ? String(form.get('address') ?? '') : '',
      deliveryZoneId: mode === 'delivery' ? String(form.get('deliveryZoneId') ?? '') || undefined : undefined,
      promotionCode: String(form.get('promotionCode') ?? '') || undefined,
      notes: String(form.get('orderNotes') ?? '')
    };
    await onSubmit(checkout);
  }

  return <div className="dialog-layer dialog-layer--checkout" role="presentation">
    <section className="checkout-dialog" role="dialog" aria-modal="true" aria-labelledby="checkout-title" ref={dialogRef} tabIndex={-1}>
      <header className="checkout-dialog__header">
        <button className="back-button" type="button" onClick={onBack} disabled={busy} aria-label="Volver al carrito">←</button>
        <div><span className="eyebrow">ÚLTIMO PASO</span><h2 id="checkout-title">¿Cómo te lo damos?</h2></div>
        <button className="dialog-close" type="button" onClick={onClose} disabled={busy} aria-label="Cerrar checkout">×</button>
      </header>
      <form className="checkout-form" onSubmit={submit}>
        <div className="checkout-form__fields">
          <fieldset className="choice-section">
            <legend>1. Elegí la modalidad</legend>
            <div className="choice-grid">
              {menu.restaurant.features.pickup ? <label className={mode === 'pickup' ? 'choice-card choice-card--selected' : 'choice-card'}><input type="radio" name="mode" checked={mode === 'pickup'} onChange={() => setMode('pickup')}/><strong>Retiro</strong><span>Pasás por el local</span></label> : null}
              {menu.restaurant.features.delivery ? <label className={mode === 'delivery' ? 'choice-card choice-card--selected' : 'choice-card'}><input type="radio" name="mode" checked={mode === 'delivery'} onChange={() => setMode('delivery')}/><strong>Delivery</strong><span>Vamos hasta tu casa</span></label> : null}
            </div>
          </fieldset>
          <fieldset className="form-section">
            <legend>2. Tus datos</legend>
            <div className="form-grid">
              <label>Nombre y apellido<input name="name" autoComplete="name" required maxLength={120}/></label>
              <label>Teléfono<input name="phone" type="tel" autoComplete="tel" required inputMode="tel" minLength={8} maxLength={40}/></label>
              <label className="form-grid__wide">Email <small>(opcional)</small><input name="email" type="email" autoComplete="email" maxLength={254}/></label>
              {mode === 'delivery' ? <>
                <label className="form-grid__wide">Dirección<input name="address" autoComplete="street-address" required maxLength={500} placeholder="Calle, número, piso o referencia"/></label>
                {menu.catalog.deliveryZones.some(zone => zone.active) ? <label className="form-grid__wide">Zona de envío<select name="deliveryZoneId" required defaultValue=""><option value="" disabled>Seleccioná tu zona</option>{menu.catalog.deliveryZones.filter(zone => zone.active).map(zone => <option key={zone.id} value={zone.id}>{zone.name} · {money(zone.fee)}</option>)}</select></label> : null}
              </> : null}
            </div>
          </fieldset>
          <fieldset className="choice-section">
            <legend>3. ¿Cómo pagás?</legend>
            <div className="payment-list">
              {payments.map(option => <label className={payment === option.value ? 'payment-option payment-option--selected' : 'payment-option'} key={option.value}>
                <input type="radio" name="payment" checked={payment === option.value} onChange={() => setPayment(option.value)}/>
                <span><strong>{option.label}</strong><small>{option.detail}</small></span><i aria-hidden="true"/>
              </label>)}
            </div>
          </fieldset>
          {menu.restaurant.features.promotions ? <label className="standalone-field">¿Tenés un código?<input name="promotionCode" autoCapitalize="characters" maxLength={60} placeholder="Ingresalo acá"/></label> : null}
          <label className="standalone-field">Nota para la cocina<textarea name="orderNotes" maxLength={1500} placeholder="Ej: tocar timbre, no golpear la puerta…"/></label>
        </div>
        <aside className="checkout-summary">
          <span className="eyebrow">RESUMEN</span><h3>Tu pedido</h3>
          <div className="checkout-summary__lines">{lines.map(line => <div key={line.key}><span><b>{line.quantity}×</b> {line.product.name}<small>{lineLabel(line)}</small></span><strong>{money(unitPrice(line) * line.quantity)}</strong></div>)}</div>
          <div className="checkout-summary__total"><span>Subtotal estimado</span><strong>{money(subtotal)}</strong></div>
          <p>El total definitivo, envío y promociones los valida BurgerHouse al confirmar.</p>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {!payments.length ? <p className="form-error" role="alert">No hay medios de pago disponibles en este momento.</p> : null}
          <button className="primary-button primary-button--wide" type="submit" disabled={busy || !lines.length || !payments.length}>{busy ? 'CONFIRMANDO…' : 'CONFIRMAR PEDIDO'}</button>
          <small className="secure-copy">Revisamos precios y disponibilidad antes de crear tu pedido.</small>
        </aside>
      </form>
    </section>
  </div>;
}
