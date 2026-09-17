import Image from 'next/image';
import type {Product} from '@nadav/core';

export function BrandMark({compact = false}: {compact?: boolean}) {
  return <span className={compact ? 'brand-mark brand-mark--compact' : 'brand-mark'} aria-label="BurgerHouse">
    <span>Burger</span><strong>House</strong>
  </span>;
}

export function Star({className = ''}: {className?: string}) {
  return <svg className={className} aria-hidden="true" viewBox="0 0 40 40"><path d="m20 1 4.2 13.3L38 20l-13.8 5.7L20 39l-4.2-13.3L2 20l13.8-5.7L20 1Z" fill="currentColor"/></svg>;
}

export function HeroBurger() {
  return <div className="hero-burger" aria-hidden="true">
    <div className="hero-burger__shadow"/>
    <div className="hero-burger__stack">
      <div className="bun bun--top"><i/><i/><i/><i/><i/></div>
      <div className="lettuce"/>
      <div className="cheese cheese--top"/>
      <div className="patty"/>
      <div className="onion"><i/><i/><i/></div>
      <div className="cheese"/>
      <div className="patty patty--lower"/>
      <div className="sauce"/>
      <div className="bun bun--bottom"/>
    </div>
    <span className="hero-burger__label">DOBLE<br/>SMASH</span>
  </div>;
}

export function HeroBurgerPhoto() {
  return <div className="hero-burger-photo">
    <div className="hero-burger-photo__halo" aria-hidden="true"/>
    <Image
      className="hero-burger-photo__image"
      src="/images/burgerhouse-hero-smash.webp"
      alt="Doble smash cheeseburger BurgerHouse con cheddar, pepinillos y cebolla"
      width={1254}
      height={1254}
      priority
      sizes="(max-width: 820px) 94vw, 52vw"
    />
    <span className="hero-burger-photo__label" aria-hidden="true">DOBLE<br/>SMASH</span>
  </div>;
}

function ProductFallback({name}: {name: string}) {
  return <div className="product-fallback" aria-hidden="true">
    <span className="mini-burger"><i/><b/><em/><strong/></span>
    <span>{name.slice(0, 1)}</span>
  </div>;
}

export function ProductVisual({product, priority = false}: {product: Product; priority?: boolean}) {
  return <div className="product-visual">
    {product.image
      ? <Image src={product.image} alt={product.name} fill sizes="(max-width: 720px) 92vw, (max-width: 1100px) 45vw, 360px" priority={priority} unoptimized/>
      : <ProductFallback name={product.name}/>}
  </div>;
}

export function BurgerSeal() {
  return <div className="burger-seal" aria-label="Hechas al momento">
    <span>BURGERS</span><strong>BH</strong><span>AL MOMENTO</span>
  </div>;
}
