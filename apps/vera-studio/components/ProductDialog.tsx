'use client';

import Image from 'next/image';
import {useEffect, useState} from 'react';
import type {Product} from '../lib/catalog';
import {money, variantFor} from '../lib/catalog';

export function ProductDialog({product, onClose, onAdd}: {product: Product; onClose: () => void; onAdd: (product: Product, variantId: string, size: string, color: string, quantity: number) => void}) {
  const [size, setSize] = useState<string | null>(product.sizes.length === 1 ? product.sizes[0] : null);
  const [color, setColor] = useState(product.colors[0]?.name ?? 'Único');
  const [quantity, setQuantity] = useState(1);
  const [details, setDetails] = useState<'description' | 'care' | 'shipping'>('description');

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="product-dialog" role="dialog" aria-modal="true" aria-labelledby="product-title">
      <button className="close-button" type="button" onClick={onClose} aria-label="Cerrar detalle">×</button>
      <div className="product-dialog__gallery">
        <Image src={product.image} alt={product.name} fill sizes="(max-width: 760px) 100vw, 50vw" priority/>
        <span className="gallery-index">01 / 01</span>
      </div>
      <div className="product-dialog__body">
        <p className="eyebrow">{product.category}</p>
        <h2 id="product-title">{product.name}</h2>
        <p className="product-dialog__price">{money(product.price)}</p>
        <fieldset className="option-group">
          <legend>Color: <strong>{color}</strong></legend>
          <div className="color-options">{product.colors.map(option => <button type="button" key={option.name} className={color === option.name ? 'selected' : ''} onClick={() => setColor(option.name)} aria-label={option.name} title={option.name}><i style={{background: option.value}}/></button>)}</div>
        </fieldset>
        <fieldset className="option-group">
          <legend className="sr-only">Talle</legend>
          <div className="size-heading"><span>Talle</span><a href="/guia-de-talles">Guía de talles</a></div>
          <div className="size-options">{product.sizes.map(option => { const available = Boolean(variantFor(product, color, option)); return <button type="button" key={option} disabled={!available} className={size === option ? 'selected' : ''} onClick={() => setSize(option)}>{option}</button>; })}</div>
        </fieldset>
        <div className="product-actions">
          <div className="quantity" aria-label="Cantidad"><button type="button" onClick={() => setQuantity(value => Math.max(1, value - 1))} aria-label="Restar">−</button><span>{quantity}</span><button type="button" onClick={() => setQuantity(value => value + 1)} aria-label="Sumar">+</button></div>
          <button className="primary-button" type="button" disabled={!size || !variantFor(product, color, size)} onClick={() => { const variant = size && variantFor(product, color, size); if (variant && size) onAdd(product, variant.id, size, color, quantity); }}>{size ? 'Agregar al carrito' : 'Elegí un talle'}</button>
        </div>
        <div className="detail-tabs" role="tablist" aria-label="Información del producto">
          <button type="button" className={details === 'description' ? 'active' : ''} onClick={() => setDetails('description')}>Detalle</button>
          <button type="button" className={details === 'care' ? 'active' : ''} onClick={() => setDetails('care')}>Composición</button>
          <button type="button" className={details === 'shipping' ? 'active' : ''} onClick={() => setDetails('shipping')}>Envíos</button>
        </div>
        <div className="detail-copy">
          {details === 'description' && <p>{product.description}</p>}
          {details === 'care' && <><p>{product.composition}</p><p>{product.care}</p></>}
          {details === 'shipping' && <p>Preparamos cada pedido desde nuestro estudio. El despacho puede demorar de 2 a 4 días hábiles. Tenés 30 días para cambios.</p>}
        </div>
        <a className="whatsapp-link" href="/contacto">¿Tenés dudas con el talle? Escribinos →</a>
      </div>
    </section>
  </div>;
}
