'use client';

import {useEffect, useMemo, useState} from 'react';
import {createNadavClient} from '@nadav/sdk';
import type {CatalogResponse, CheckoutInput, Product} from '@nadav/core';

type Config = {coreUrl: string; slug: string; presentation: {name: string; accent: string; background: string}};
const money = (value: number) => new Intl.NumberFormat('es-AR', {style: 'currency', currency: 'ARS', maximumFractionDigits: 0}).format(value);
export function Storefront({config}: {config: Config}) {
  const api = useMemo(() => createNadavClient({baseUrl: config.coreUrl, restaurant: config.slug}), [config.coreUrl, config.slug]);
  const [menu, setMenu] = useState<CatalogResponse | null>(null);
  const [cart, setCart] = useState<{product: Product; quantity: number}[]>([]);
  const [status, setStatus] = useState('');
  useEffect(() => { let mounted = true; api.catalog.get().then(value => { if (mounted) setMenu(value); }).catch(error => { if (mounted) setStatus(error instanceof Error ? error.message : 'No se pudo cargar el menú.'); }); return () => { mounted = false; }; }, [api]);
  function add(product: Product) { setCart(lines => { const existing = lines.find(line => line.product.id === product.id); return existing ? lines.map(line => line.product.id === product.id ? {...line, quantity: line.quantity + 1} : line) : [...lines, {product, quantity: 1}]; }); }
  async function submit(form: FormData) {
    const checkout: CheckoutInput = {items: cart.map(line => ({productId: line.product.id, quantity: line.quantity, selections: line.product.modifierGroups.map(group => ({groupId: group.id, optionId: group.options[0].id}))})), customer: {name: String(form.get('name')), phone: String(form.get('phone'))}, mode: form.get('mode') === 'delivery' ? 'delivery' : 'pickup', paymentMethod: form.get('payment') === 'transfer' ? 'transfer' : 'cash', address: String(form.get('address') ?? '')};
    setStatus('Procesando…');
    try { const result = await api.checkout.createOrder(checkout); setStatus(`Pedido #${result.order.number} confirmado · ${money(result.order.total)}`); setCart([]); } catch (error) { setStatus(error instanceof Error ? error.message : 'No se pudo crear el pedido.'); }
  }
  if (!menu) return <main className="empty">{status || 'Cargando…'}</main>;
  return <div className="site" style={{'--accent': config.presentation.accent, '--background': config.presentation.background} as React.CSSProperties}><header><b>{config.presentation.name}</b><a href="#checkout">Carrito ({cart.reduce((sum, line) => sum + line.quantity, 0)})</a></header><main><section className="intro"><span>MENÚ ONLINE</span><h1>{menu.restaurant.name}</h1><p>{menu.restaurant.tagline}</p></section>{menu.catalog.categories.map(category => <section className="category" key={category.id}><h2>{category.name}</h2><div>{menu.catalog.products.filter(product => product.categoryId === category.id).map(product => <article key={product.id}><h3>{product.name}</h3><p>{product.description}</p><footer><b>{money(product.promotionalPrice ?? product.price)}</b><button onClick={() => add(product)}>Agregar</button></footer></article>)}</div></section>)}<section className="checkout" id="checkout"><div><h2>Tu pedido</h2>{cart.map(line => <p key={line.product.id}>{line.quantity} × {line.product.name}</p>)}</div><form action={submit}><input name="name" placeholder="Nombre" required/><input name="phone" placeholder="Teléfono" required/><select name="mode"><option value="pickup">Retiro</option><option value="delivery">Delivery</option></select><input name="address" placeholder="Dirección para delivery"/><select name="payment"><option value="cash">Efectivo</option><option value="transfer">Transferencia</option></select><button disabled={!cart.length}>Crear pedido</button><p role="status">{status}</p></form></section></main></div>;
}
