'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createNadavClient} from '@nadav/sdk';
import type {CatalogResponse, CartSelection, CheckoutInput, Order, Product} from '@nadav/core';
import {BrandMark, BurgerSeal, HeroBurger, HeroBurgerPhoto, Star} from './BrandArtwork';
import {CartDrawer} from './CartDrawer';
import {CheckoutDialog} from './CheckoutDialog';
import {OrderSuccess} from './OrderSuccess';
import {ProductCard} from './ProductCard';
import {ProductDialog} from './ProductDialog';
import {unitPrice, type CartLine, type StorefrontConfig} from './storefront-types';

type CompletedOrder = {order: Order; paymentUrl?: string};
const money = (value: number) => new Intl.NumberFormat('es-AR', {style: 'currency', currency: 'ARS', maximumFractionDigits: 0}).format(value);

function cartKey(product: Product, selections: CartSelection[], notes: string) {
  const options = selections.map(selection => `${selection.groupId}:${selection.optionId}`).sort().join('|');
  return `${product.id}::${options}::${notes.toLocaleLowerCase()}`;
}

export function Storefront({config}: {config: StorefrontConfig}) {
  const api = useMemo(() => createNadavClient({baseUrl: config.coreUrl, restaurant: config.slug}), [config.coreUrl, config.slug]);
  const [menu, setMenu] = useState<CatalogResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState<CompletedOrder | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartFeedback, setCartFeedback] = useState('');
  const submission = useRef<{fingerprint: string; key: string} | null>(null);

  useEffect(() => {
    let mounted = true;
    api.catalog.get()
      .then(value => { if (mounted) setMenu(value); })
      .catch(() => { if (mounted) setLoadError('No pudimos cargar el menú. Probá de nuevo en un ratito.'); });
    return () => { mounted = false; };
  }, [api]);

  const overlayOpen = Boolean(selectedProduct || cartOpen || checkoutOpen || completed);
  useEffect(() => {
    if (!overlayOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [overlayOpen]);

  const closeProduct = useCallback(() => setSelectedProduct(null), []);
  const closeCart = useCallback(() => setCartOpen(false), []);
  const closeCheckout = useCallback(() => { if (!busy) setCheckoutOpen(false); }, [busy]);
  const itemCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartSubtotal = cart.reduce((sum, line) => sum + unitPrice(line) * line.quantity, 0);

  useEffect(() => {
    if (!cartFeedback) return;
    const timeout = window.setTimeout(() => setCartFeedback(''), 2200);
    return () => window.clearTimeout(timeout);
  }, [cartFeedback]);

  function add(product: Product, quantity: number, selections: CartSelection[], notes: string) {
    const key = cartKey(product, selections, notes);
    setCart(lines => {
      const existing = lines.find(line => line.key === key);
      return existing
        ? lines.map(line => line.key === key ? {...line, quantity: Math.min(99, line.quantity + quantity)} : line)
        : [...lines, {key, product, quantity, selections, notes}];
    });
    submission.current = null;
    setCartFeedback(`${quantity} ${quantity === 1 ? 'producto agregado' : 'productos agregados'} al pedido`);
    setSelectedProduct(null);
    setCartOpen(true);
  }

  function updateQuantity(key: string, quantity: number) {
    if (quantity < 1) return removeLine(key);
    setCart(lines => lines.map(line => line.key === key ? {...line, quantity: Math.min(99, quantity)} : line));
    submission.current = null;
  }

  function removeLine(key: string) {
    setCart(lines => lines.filter(line => line.key !== key));
    submission.current = null;
  }

  async function placeOrder(checkout: CheckoutInput) {
    setBusy(true);
    setCheckoutError('');
    try {
      await api.cart.quote(checkout);
      const fingerprint = JSON.stringify(checkout);
      if (!submission.current || submission.current.fingerprint !== fingerprint) submission.current = {fingerprint, key: crypto.randomUUID()};
      const result = await api.checkout.createOrder(checkout, submission.current.key);
      setCompleted(result);
      setCheckoutOpen(false);
      setCart([]);
      submission.current = null;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'No pudimos confirmar el pedido. Revisá los datos e intentá nuevamente.');
    } finally {
      setBusy(false);
    }
  }

  if (!menu) return <main className={`loading-screen${loadError ? ' loading-screen--error' : ''}`} aria-live="polite" aria-busy={!loadError}>
    <BrandMark/>
    {loadError ? <><span className="loading-screen__status">NO PUDIMOS CARGAR</span><h1>La plancha sigue encendida.</h1><p>{loadError}</p><button type="button" className="primary-button" onClick={() => location.reload()}>VOLVER A INTENTAR</button></> : <><div className="loading-burger" aria-hidden="true"><i/><i/><i/></div><p>Prendiendo la plancha…</p></>}
  </main>;

  return <div className="site" style={{'--brand-red': config.presentation.accent, '--cream': config.presentation.background} as React.CSSProperties}>
    <a className="skip-link" href="#menu">Saltar al menú</a>
    <header className="site-header">
      <a className="header-brand" href="#top" aria-label="BurgerHouse, inicio"><BrandMark compact/></a>
      <nav className="desktop-nav" aria-label="Navegación principal">
        <a href="#menu">Menú</a><a href="#nosotros">Nosotros</a><a href="#horarios">Horarios</a>
      </nav>
      <div className="header-actions">
        <a className="header-order" href="#menu">PEDIR AHORA</a>
        <button className="cart-button" type="button" onClick={() => setCartOpen(true)} aria-label={`Abrir carrito con ${itemCount} productos`}>
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H7M9.5 20a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Zm8 0a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"/></svg>
          <span>Carrito</span><b>{itemCount}</b>
        </button>
        <button className="mobile-menu-button" type="button" aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation" onClick={() => setMobileMenuOpen(open => !open)}>
          <span className="sr-only">{mobileMenuOpen ? 'Cerrar navegación' : 'Abrir navegación'}</span>
          <i/><i/>
        </button>
      </div>
      {mobileMenuOpen ? <>
        <button className="mobile-nav-backdrop" type="button" aria-label="Cerrar navegación" onClick={() => setMobileMenuOpen(false)}/>
        <nav className="mobile-nav" id="mobile-navigation" aria-label="Navegación móvil">
          <a href="#menu" onClick={() => setMobileMenuOpen(false)}><span>01</span> Menú</a>
          <a href="#nosotros" onClick={() => setMobileMenuOpen(false)}><span>02</span> Nosotros</a>
          <a href="#horarios" onClick={() => setMobileMenuOpen(false)}><span>03</span> Horarios</a>
          <a className="mobile-nav__order" href="#menu" onClick={() => setMobileMenuOpen(false)}>PEDIR AHORA <span aria-hidden="true">↗</span></a>
        </nav>
      </> : null}
    </header>

    <main id="top">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__checker" aria-hidden="true"/>
        <div className="hero__copy">
          <div className="hero__kicker"><Star/> <span>SMASHED FRESH · SIN VUELTAS</span> <Star/></div>
          <h1 id="hero-title"><span>BURGERS</span><em>QUE PEGAN</em><strong>DISTINTO.</strong></h1>
          <p>Carne bien dorada, queso fundido y pan suave. Hechas al momento, como tiene que ser.</p>
          <div className="hero__actions"><a className="primary-button" href="#menu">PEDIR AHORA <span aria-hidden="true">↗</span></a><a className="secondary-button" href="#menu">VER MENÚ</a></div>
          <div className="hero__note"><i aria-hidden="true"/><span>Delivery y retiro<br/><b>todos los días</b></span></div>
        </div>
        <div className="hero__art">
          <span className="hero-sticker hero-sticker--top">100%<br/><b>SMASH</b></span>
          <HeroBurgerPhoto/>
          <span className="hero-sticker hero-sticker--bottom">HOT &<br/><b>FRESH</b></span>
        </div>
        <div className="hero__wordmark"><BrandMark/></div>
      </section>

      <div className="ticker" aria-hidden="true"><div><span>SMASHED FRESH</span><Star/><span>QUESO DE VERDAD</span><Star/><span>CERO VUELTAS</span><Star/><span>SMASHED FRESH</span><Star/><span>QUESO DE VERDAD</span><Star/></div></div>

      <section className="menu-section" id="menu" aria-labelledby="menu-title">
        <div className="section-heading">
          <div><span className="eyebrow">ELEGÍ TU FAVORITA</span><h2 id="menu-title">Nuestras burgers</h2></div>
          <p>Bien aplastadas, doradas en la plancha y armadas cuando las pedís. Acá no hay misterio.</p>
        </div>
        <nav className="category-nav" aria-label="Categorías del menú">
          {menu.catalog.categories.map(category => <a href={`#category-${category.id}`} key={category.id}>{category.name}</a>)}
        </nav>
        {menu.catalog.categories.map((category, categoryIndex) => {
          const products = menu.catalog.products.filter(product => product.categoryId === category.id);
          if (!products.length) return null;
          return <section className="menu-category" id={`category-${category.id}`} key={category.id} aria-labelledby={`title-${category.id}`}>
            <header><h3 id={`title-${category.id}`}>{category.name}</h3><span>{String(products.length).padStart(2, '0')} opciones</span></header>
            <div className="product-grid">{products.map((product, productIndex) => <ProductCard product={product} onOpen={setSelectedProduct} priority={categoryIndex === 0 && productIndex < 2} key={product.id}/>)}</div>
          </section>;
        })}
      </section>

      <section className="craft-section" id="nosotros">
        <div className="craft-section__art"><div className="craft-plate"><HeroBurger/></div><BurgerSeal/></div>
        <div className="craft-section__copy"><span className="eyebrow">NO ES SOLO UNA BURGER</span><h2>El borde crujiente cambia todo.</h2><p>Aplastamos la carne contra la plancha bien caliente para lograr esa costra que hace ruido. Después: queso, salsa de la casa y pan tostado. Nada raro. Todo bien hecho.</p><ul><li><b>01</b> Carne seleccionada</li><li><b>02</b> Plancha a fondo</li><li><b>03</b> Armada al pedir</li></ul></div>
      </section>

      <section className="manifesto-section">
        <div><Star/><span>LA CASA DEL SMASH</span><Star/></div>
        <h2>Pedí.<br/><em>Comé.</em><br/>Repetí.</h2>
        <p>Empezamos con una plancha, una receta simple y una obsesión: que cada burger salga mejor que la anterior.</p>
      </section>

      <section className="service-section" id="horarios">
        <article><span className="service-icon" aria-hidden="true">↗</span><span className="eyebrow">DÓNDE</span><h3>Vení a buscarla</h3><p>{config.presentation.address}</p><a href={config.presentation.whatsapp}>¿Cómo llegar? →</a></article>
        <article className="service-section__red"><span className="service-icon" aria-hidden="true">◷</span><span className="eyebrow">CUÁNDO</span><h3>Plancha encendida</h3><p>{config.presentation.hours}</p><a href="#menu">Hacer un pedido →</a></article>
        <article><span className="service-icon" aria-hidden="true">⌂</span><span className="eyebrow">CÓMO</span><h3>{menu.restaurant.features.delivery ? 'Te la llevamos' : 'Retirá en el local'}</h3><p>{menu.restaurant.features.delivery && menu.restaurant.features.pickup ? 'Delivery o retiro. Vos elegís.' : menu.restaurant.features.delivery ? 'Delivery disponible.' : 'Lista para retirar.'}</p><a href="#menu">Ver el menú →</a></article>
      </section>

      <section className="social-strip">
        <div><span className="eyebrow">SEGUINOS</span><h2>Lo bueno se comparte.</h2><a href={config.presentation.instagram} target="_blank" rel="noreferrer">@burgerhouse ↗</a></div>
        <div className="social-tiles" aria-hidden="true"><span>SMASH</span><span><Star/></span><span>CHEESE</span><span>REPEAT</span></div>
      </section>
    </main>

    <footer className="site-footer">
      <div className="site-footer__top"><BrandMark/><p>Smash, queso y cero vueltas.<br/>Hechas al momento en La Plata.</p><nav aria-label="Navegación del pie"><a href="#menu">Menú</a><a href="#nosotros">Nosotros</a><a href="#horarios">Horarios</a><a href={config.presentation.instagram}>Instagram</a></nav></div>
      <div className="site-footer__bottom"><span>© {new Date().getFullYear()} BURGERHOUSE</span><span>{config.presentation.slogan}</span></div>
    </footer>

    {itemCount > 0 && !overlayOpen ? <button className="mobile-cart-bar" type="button" onClick={() => setCartOpen(true)}>
      <span className="mobile-cart-bar__count">{itemCount}</span>
      <span className="mobile-cart-bar__copy"><strong>VER PEDIDO</strong><small>{itemCount === 1 ? '1 producto' : `${itemCount} productos`}</small></span>
      <b>{money(cartSubtotal)} <span aria-hidden="true">→</span></b>
    </button> : null}
    <div className="sr-only" aria-live="polite">{cartFeedback || (itemCount ? `${itemCount} productos en el carrito` : 'Carrito vacío')}</div>

    {selectedProduct ? <ProductDialog product={selectedProduct} onClose={closeProduct} onAdd={add}/> : null}
    {cartOpen ? <CartDrawer lines={cart} onClose={closeCart} onQuantity={updateQuantity} onRemove={removeLine} onCheckout={() => { setCartOpen(false); setCheckoutError(''); setCheckoutOpen(true); }}/> : null}
    {checkoutOpen ? <CheckoutDialog menu={menu} lines={cart} busy={busy} error={checkoutError} onBack={() => { setCheckoutOpen(false); setCartOpen(true); }} onClose={closeCheckout} onSubmit={placeOrder}/> : null}
    {completed ? <OrderSuccess order={completed.order} paymentUrl={completed.paymentUrl} onDone={() => { setCompleted(null); document.querySelector('#menu')?.scrollIntoView({behavior: 'smooth'}); }}/> : null}
  </div>;
}
