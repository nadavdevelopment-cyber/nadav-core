import type {Product} from '@nadav/core';
import {ProductVisual} from './BrandArtwork';

const money = (value: number) => new Intl.NumberFormat('es-AR', {style: 'currency', currency: 'ARS', maximumFractionDigits: 0}).format(value);

function badgeFor(product: Product) {
  if (!product.available || product.stock === 0) return 'AGOTADA';
  if (product.promotionalPrice !== null && product.promotionalPrice !== undefined) return 'PROMO';
  if (product.stock !== null && product.stock <= 5) return 'ÚLTIMAS';
  if (/picante|spicy|jalape/i.test(product.name)) return 'SPICY';
  if (/nuev/i.test(product.name)) return 'NUEVA';
  return null;
}

export function ProductCard({product, onOpen, priority}: {product: Product; onOpen: (product: Product) => void; priority?: boolean}) {
  const badge = badgeFor(product);
  const price = product.promotionalPrice ?? product.price;
  const available = product.available && product.stock !== 0;
  return <article className={`product-card${available ? '' : ' product-card--disabled'}`}>
    <button className="product-card__visual" type="button" onClick={() => onOpen(product)} aria-label={`Ver ${product.name}`} disabled={!available}>
      <ProductVisual product={product} priority={priority}/>
      {badge ? <span className="product-badge">{badge}</span> : null}
    </button>
    <div className="product-card__body">
      <div className="product-card__heading">
        <h3>{product.name}</h3>
        <strong>{money(price)}</strong>
      </div>
      <p>{product.description}</p>
      <div className="product-card__footer">
        <span>{product.stock !== null && available ? `${product.stock} disponibles` : available ? 'Hecha al momento' : 'Sin stock'}</span>
        <button type="button" className="round-add" onClick={() => onOpen(product)} disabled={!available} aria-label={`Agregar ${product.name}`}>
          <span aria-hidden="true">+</span>
        </button>
      </div>
    </div>
  </article>;
}
