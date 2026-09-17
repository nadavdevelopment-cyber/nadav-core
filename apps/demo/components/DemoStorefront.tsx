'use client';

import {useEffect, useMemo, useState} from 'react';
import {createNadavClient} from '@nadav/sdk';
import type {CatalogResponse, CheckoutInput, Product} from '@nadav/core';

type Config = {coreUrl: string; restaurant: string; presentation: {accent: string; background: string; heading: string}};
type CartLine = {product: Product; quantity: number};
const money = (value: number) => new Intl.NumberFormat('es-AR', {style: 'currency', currency: 'ARS', maximumFractionDigits: 0}).format(value);

export function DemoStorefront({config}: {config: Config}) {
  const client = useMemo(() => createNadavClient({baseUrl: config.coreUrl, restaurant: config.restaurant}), [config.coreUrl, config.restaurant]);
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; client.catalog.get().then(result => { if (active) setData(result); }).catch(error => { if (active) setMessage(error instanceof Error ? error.message : 'No se pudo cargar el menú.'); }); return () => { active = false; }; }, [client]);
  const subtotal = cart.reduce((sum, line) => sum + (line.product.promotionalPrice ?? line.product.price) * line.quantity, 0);
  function add(product: Product) { setCart(current => { const found = current.find(line => line.product.id === product.id); return found ? current.map(line => line.product.id === product.id ? {...line, quantity: line.quantity + 1} : line) : [...current, {product, quantity: 1}]; }); }
  async function checkout(form: FormData) {
    setBusy(true); setMessage('');
    const input: CheckoutInput = {items: cart.map(line => ({productId: line.product.id, quantity: line.quantity, selections: line.product.modifierGroups.map(group => ({groupId: group.id, optionId: group.options[0].id}))})), customer: {name: String(form.get('name')), phone: String(form.get('phone')), email: String(form.get('email'))}, mode: form.get('mode') === 'delivery' ? 'delivery' : 'pickup', paymentMethod: form.get('payment') === 'transfer' ? 'transfer' : 'cash', address: String(form.get('address')), deliveryZoneId: data?.catalog.deliveryZones[0]?.id, notes: ''};
    try { const result = await client.checkout.createOrder(input); setCart([]); setMessage(`Pedido #${result.order.number} creado. Total ${money(result.order.total)}.`); } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo crear el pedido.'); } finally { setBusy(false); }
  }
  if (!data) return <main className="loading"><span>N</span><p>{message || 'Cargando menú…'}</p></main>;
  return <div className="store" style={{'--accent': config.presentation.accent, '--background': config.presentation.background} as React.CSSProperties}>
    <header><div className="wordmark"><span>N</span><div><b>{data.restaurant.name}</b><small>DEMO SOBRE NADAV CORE</small></div></div><a href="#cart">Pedido · {cart.reduce((sum, line) => sum + line.quantity, 0)}</a></header>
    <main><section className="hero"><p>RESTAURANTE DEMOSTRACIÓN</p><h1>{config.presentation.heading}</h1><span>{data.restaurant.tagline}</span></section>
      <section className="catalog">{data.catalog.categories.map(category => <div key={category.id}><h2>{category.name}</h2><div className="products">{data.catalog.products.filter(product => product.categoryId === category.id).map(product => <article key={product.id}><div><small>{product.promotionalPrice ? 'PRECIO ESPECIAL' : 'HECHO EN EL MOMENTO'}</small><h3>{product.name}</h3><p>{product.description}</p></div><footer><strong>{money(product.promotionalPrice ?? product.price)}</strong><button onClick={() => add(product)} aria-label={`Agregar ${product.name}`}>+</button></footer></article>)}</div></div>)}</section>
      <section className="checkout" id="cart"><div><p>TU PEDIDO</p><h2>{cart.length ? `${cart.reduce((sum, line) => sum + line.quantity, 0)} productos` : 'Todavía está vacío'}</h2>{cart.map(line => <span key={line.product.id}>{line.quantity} × {line.product.name}<b>{money((line.product.promotionalPrice ?? line.product.price) * line.quantity)}</b></span>)}<strong>Subtotal <b>{money(subtotal)}</b></strong></div><form action={checkout}><label>Nombre<input name="name" required maxLength={120}/></label><label>Teléfono<input name="phone" required inputMode="tel"/></label><label>Email<input name="email" type="email"/></label><label>Modalidad<select name="mode"><option value="pickup">Retiro</option><option value="delivery">Delivery</option></select></label><label>Dirección<input name="address"/></label><label>Pago<select name="payment"><option value="cash">Efectivo</option><option value="transfer">Transferencia</option></select></label><button disabled={!cart.length || busy}>{busy ? 'Creando pedido…' : 'Confirmar pedido'}</button>{message ? <p role="status">{message}</p> : null}</form></section>
    </main><footer className="site-footer">Frontend independiente · Powered by NADAV Core</footer>
  </div>;
}
