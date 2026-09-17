'use client';

import type {CartLine} from './storefront-types';
import {lineLabel, unitPrice} from './storefront-types';
import {useDialogFocus} from './useDialogFocus';

const money = (value: number) => new Intl.NumberFormat('es-AR', {style: 'currency', currency: 'ARS', maximumFractionDigits: 0}).format(value);

export function CartDrawer({lines, onClose, onQuantity, onRemove, onCheckout}: {lines: CartLine[]; onClose: () => void; onQuantity: (key: string, quantity: number) => void; onRemove: (key: string) => void; onCheckout: () => void}) {
  const dialogRef = useDialogFocus<HTMLElement>(onClose);
  const subtotal = lines.reduce((sum, line) => sum + unitPrice(line) * line.quantity, 0);

  return <div className="drawer-layer" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) onClose(); }}>
    <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" ref={dialogRef} tabIndex={-1}>
      <header className="cart-drawer__header">
        <div><span className="eyebrow">TU PEDIDO</span><h2 id="cart-title">La bolsa</h2></div>
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Cerrar carrito">×</button>
      </header>
      {lines.length ? <>
        <div className="cart-lines">
          {lines.map(line => <article className="cart-line" key={line.key}>
            <div className="cart-line__copy">
              <h3>{line.product.name}</h3>
              {lineLabel(line) ? <p>{lineLabel(line)}</p> : null}
              {line.notes ? <p>“{line.notes}”</p> : null}
              <strong>{money(unitPrice(line) * line.quantity)}</strong>
            </div>
            <div className="cart-line__actions">
              <div className="quantity-control quantity-control--small">
                <button type="button" onClick={() => onQuantity(line.key, line.quantity - 1)} aria-label={`Restar ${line.product.name}`}>−</button>
                <output>{line.quantity}</output>
                <button type="button" onClick={() => onQuantity(line.key, line.quantity + 1)} aria-label={`Sumar ${line.product.name}`}>+</button>
              </div>
              <button className="text-button" type="button" onClick={() => onRemove(line.key)}>Quitar</button>
            </div>
          </article>)}
        </div>
        <footer className="cart-drawer__footer">
          <div className="cart-total"><span>Subtotal estimado</span><strong>{money(subtotal)}</strong></div>
          <p>El envío y los descuentos se calculan antes de confirmar.</p>
          <button className="primary-button primary-button--wide" type="button" onClick={onCheckout}>CONTINUAR</button>
          <button className="secondary-button secondary-button--wide" type="button" onClick={onClose}>SEGUIR ELIGIENDO</button>
        </footer>
      </> : <div className="empty-cart">
        <span aria-hidden="true">◎</span><h3>Todavía no elegiste nada</h3><p>Hay una smash esperándote en el menú.</p>
        <button className="primary-button" type="button" onClick={onClose}>VER EL MENÚ</button>
      </div>}
    </aside>
  </div>;
}
