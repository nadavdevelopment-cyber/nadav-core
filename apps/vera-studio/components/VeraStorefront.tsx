'use client';

import Image from 'next/image';
import {useEffect, useMemo, useRef, useState} from 'react';
import type {CommerceCatalog, CommerceOrder} from '@nadav/core';
import {productForStorefront, type Category, type Product} from '../lib/catalog';
import {veraClient} from '../lib/client';
import {CartDrawer} from './CartDrawer';
import {CheckoutDialog} from './CheckoutDialog';
import {OrderSuccess} from './OrderSuccess';
import {ProductCard} from './ProductCard';
import {ProductDialog} from './ProductDialog';
import {SiteFooter} from './SiteFooter';
import {SiteHeader} from './SiteHeader';
import type {CartLine, CheckoutData} from './types';

const categoryArt: Record<string, string> = {Tops: '/images/camisa-alma.webp', Abrigos: '/images/cardigan-olivia.webp', Pantalones: '/images/pantalon-ambar.webp', Accesorios: '/images/bolso-lia.webp'};

export function VeraStorefront() {
  const [catalog, setCatalog] = useState<CommerceCatalog | null>(null);
  const [category, setCategory] = useState('Todos');
  const [selected, setSelected] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [success, setSuccess] = useState<{number: string; lines: CartLine[]; customer: CheckoutData; order: CommerceOrder} | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const checkoutKey = useRef<string | null>(null);
  const client = useMemo(() => { try { return veraClient(); } catch { return null; } }, []);
  useEffect(() => { let cancelled = false; if (!client) { setLoading(false); setLoadError('La tienda no está configurada todavía.'); return; } client.commerce.catalog().then(response => { if (!cancelled) { setCatalog(response.catalog); setLoading(false); } }).catch(() => { if (!cancelled) { setLoading(false); setLoadError('No pudimos cargar la colección. Intentá de nuevo en unos minutos.'); } }); return () => { cancelled = true; }; }, [client]);
  const products = catalog?.products.map(product => productForStorefront(product, catalog)) ?? [];
  const categories = ['Todos', ...(catalog?.categories.filter(row => row.active).sort((a, b) => a.position - b.position).map(row => row.name) ?? [])];
  const visible = category === 'Todos' ? products : products.filter(product => product.category === category);
  const count = cart.reduce((sum, line) => sum + line.quantity, 0);

  const add = (product: Product, variantId: string, size: string, color: string, quantity: number) => {
    const key = `${product.id}-${variantId}`;
    setCart(current => {
      const existing = current.find(line => line.key === key);
      return existing ? current.map(line => line.key === key ? {...line, quantity: line.quantity + quantity} : line) : [...current, {key, product, variantId, size, color, quantity}];
    });
    setSelected(null);
    setCartOpen(true);
  };

  const scrollTo = (id: string) => { document.getElementById(id)?.scrollIntoView({behavior: 'smooth'}); };
  const complete = async (customer: CheckoutData) => {
    if (!client || !catalog) throw new Error('La tienda no está disponible.');
    const key = checkoutKey.current ?? (checkoutKey.current = crypto.randomUUID());
    const result = await client.commerce.createOrder({items: cart.map(line => ({productId: line.product.id, variantId: line.variantId, quantity: line.quantity})), customer: {name: customer.name, email: customer.email, phone: customer.phone}, fulfillment: customer.fulfillment, address: customer.address, city: customer.city, paymentMethod: customer.payment}, key);
    checkoutKey.current = null;
    setCheckoutOpen(false); setSuccess({number: String(result.order.number), lines: cart, customer, order: result.order}); setCart([]);
  };
  return <>
    <SiteHeader cartCount={count} onOpenCart={() => setCartOpen(true)}/>

    <main id="inicio">
      <section className="hero">
        <div className="hero__copy"><p className="eyebrow">{catalog?.content.heroEyebrow ?? 'Nueva colección · Primavera'}</p><h1>{catalog?.content.heroTitle ?? 'Vestirse'}<br/><em>{catalog?.content.heroEmphasis ?? 'como una misma.'}</em></h1><p>{catalog?.content.heroDescription ?? 'Prendas simples, femeninas y pensadas para usar una y otra vez.'}</p><button className="primary-button" type="button" onClick={() => scrollTo('coleccion')}>Ver colección</button></div>
        <div className="hero__image"><Image src="/images/vera-hero.webp" alt="Nueva colección de Vera Studio" fill sizes="(max-width: 760px) 100vw, 62vw" priority/><span>01 / Colección</span></div>
        <p className="hero__aside">Ediciones pequeñas<br/>desde La Plata</p>
      </section>

      <section className="service-strip" aria-label="Información de compra"><span>{catalog?.content.shippingNote ?? 'Preparamos cada pedido desde nuestro estudio.'}</span><span>Cambios simples</span><span>Compra segura</span><span>Atención cercana</span></section>

      <section className="collection section" id="coleccion">
        <div className="section-heading"><div><p className="eyebrow">Recién llegados</p><h2>Novedades</h2></div><p>Una selección chica, pensada para combinar entre sí y acompañarte mucho tiempo.</p></div>
        <div className="category-tabs" role="tablist" aria-label="Filtrar productos">{categories.map(item => <button type="button" role="tab" aria-selected={category === item} className={category === item ? 'active' : ''} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div>
        {loading && <p className="catalog-message">Cargando la colección…</p>}
        {loadError && <p className="catalog-message catalog-message--error" role="alert">{loadError}</p>}
        {!loading && !loadError && <div className="product-grid">{visible.map((product, index) => <ProductCard key={product.id} product={product} onOpen={setSelected} priority={index < 4}/>)}</div>}
      </section>

      <section className="categories section" id="categorias"><div className="section-heading"><div><p className="eyebrow">Encontrá lo tuyo</p><h2>Por categoría</h2></div></div><div className="category-grid">{(catalog?.categories.filter(row => row.active) ?? []).map((item, index) => <button type="button" key={item.id} className={index === 0 ? 'large' : ''} onClick={() => { setCategory(item.name); scrollTo('coleccion'); }}><Image src={categoryArt[item.name] ?? '/images/vera-hero.webp'} alt="" fill sizes="(max-width: 680px) 100vw, 33vw"/><span>{item.name}<i>→</i></span></button>)}</div></section>

      <section className="studio section" id="estudio"><div className="studio__monogram" aria-hidden="true">V</div><div><p className="eyebrow">Hecho con intención</p><h2>Un estudio pequeño.<br/><em>Prendas para la vida real.</em></h2></div><div className="studio__copy"><p>{catalog?.content.studioCopy ?? 'Seleccionamos cada prenda pensando en cómo se usa de verdad: con qué combina, cómo cae y cuánto la vas a elegir.'}</p><p>Trabajamos con colecciones chicas y preparamos cada pedido desde nuestro estudio, con tiempo y cuidado.</p><a href="/contacto">Conocé más sobre Vera →</a></div></section>

      <section className="community section"><div className="community__copy"><p className="eyebrow">El estudio, de cerca</p><h2>Vera, todos los días.</h2><p>Ideas para combinar, novedades del estudio y un poco de lo que pasa detrás de cada pedido.</p><a href="/contacto">Hacé una consulta →</a></div><div className="community__tiles"><div><Image src="/images/top-vera.webp" alt="Top Vera" fill sizes="25vw"/></div><div><Image src="/images/bolso-lia.webp" alt="Bolso Lía" fill sizes="25vw"/></div><div><Image src="/images/blazer-elena.webp" alt="Blazer Elena" fill sizes="25vw"/></div></div></section>
    </main>

    <SiteFooter/>

    {selected && <ProductDialog product={selected} onClose={() => setSelected(null)} onAdd={add}/>}
    <CartDrawer lines={cart} open={cartOpen} onClose={() => setCartOpen(false)} onQuantity={(key, quantity) => setCart(current => current.map(line => line.key === key ? {...line, quantity} : line))} onRemove={key => setCart(current => current.filter(line => line.key !== key))} onCheckout={() => { checkoutKey.current = crypto.randomUUID(); setCartOpen(false); setCheckoutOpen(true); }}/>
    {checkoutOpen && <CheckoutDialog lines={cart} deliveryFee={catalog?.settings.deliveryFee ?? 0} onClose={() => setCheckoutOpen(false)} onComplete={complete}/>}
    {success && <OrderSuccess {...success} onClose={() => setSuccess(null)}/>}
  </>;
}
