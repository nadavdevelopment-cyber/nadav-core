import Image from 'next/image';
import type {Product} from '../lib/catalog';
import {money} from '../lib/catalog';

export function ProductCard({product, onOpen, priority = false}: {product: Product; onOpen: (product: Product) => void; priority?: boolean}) {
  return <article className="product-card">
    <button className="product-card__image" type="button" onClick={() => onOpen(product)} aria-label={`Ver ${product.name}`}>
      <Image src={product.image} alt={product.name} fill sizes="(max-width: 680px) 50vw, (max-width: 1100px) 33vw, 25vw" priority={priority}/>
    </button>
    <button className="product-card__info" type="button" onClick={() => onOpen(product)}>
      <span><strong>{product.name}</strong><small>{product.category}</small></span>
      <span className="product-card__price">{money(product.price)}</span>
    </button>
    <div className="swatches" aria-label="Colores disponibles">
      {product.colors.map(color => <i key={color.name} style={{background: color.value}} title={color.name}/>) }
    </div>
  </article>;
}
