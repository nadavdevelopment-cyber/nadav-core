'use client';

import Image from 'next/image';
import {useEffect} from 'react';
import {money} from '../lib/catalog';
import type {CartLine} from './types';

export function CartDrawer({lines, open, onClose, onQuantity, onRemove, onCheckout}: {lines: CartLine[]; open: boolean; onClose: () => void; onQuantity: (key: string, quantity: number) => void; onRemove: (key: string) => void; onCheckout: () => void}) {
  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);
  if (!open) return null;

  return <div className="drawer-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
      <header><div><p className="eyebrow">Tu selección</p><h2 id="cart-title">Carrito <span>{lines.reduce((sum, line) => sum + line.quantity, 0)}</span></h2></div><button className="close-button" type="button" onClick={onClose} aria-label="Cerrar carrito">×</button></header>
      <div className="cart-lines">
        {lines.length === 0 ? <div className="empty-state"><span>V</span><h3>Tu carrito está vacío</h3><p>Recorré la colección y elegí tus prendas favoritas.</p><button type="button" className="text-button" onClick={onClose}>Ver colección →</button></div> : lines.map(line => <article className="cart-line" key={line.key}>
          <div className="cart-line__image"><Image src={line.product.image} alt="" fill sizes="100px"/></div>
          <div><h3>{line.product.name}</h3><p>{line.color} · Talle {line.size}</p><strong>{money(line.product.price)}</strong><div className="cart-line__controls"><div className="quantity"><button type="button" onClick={() => onQuantity(line.key, Math.max(1, line.quantity - 1))} aria-label="Restar">−</button><span>{line.quantity}</span><button type="button" onClick={() => onQuantity(line.key, line.quantity + 1)} aria-label="Sumar">+</button></div><button type="button" onClick={() => onRemove(line.key)}>Eliminar</button></div></div>
        </article>)}
      </div>
      {lines.length > 0 && <footer><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><p>El envío se calcula en el siguiente paso.</p><button className="primary-button" type="button" onClick={onCheckout}>Continuar compra</button></footer>}
    </aside>
  </div>;
}
