'use client';

import Link from 'next/link';
import {useEffect, useMemo, useState, type ReactNode} from 'react';
import type {
  CommerceCatalog,
  CommerceCategory,
  CommerceContent,
  CommerceOrder,
  CommerceOrderStatus,
  CommercePaymentStatus,
  CommerceProduct,
  CommerceSettings,
  CommerceVariant
} from '@nadav/core';
import {veraClient} from '../lib/client';
import {money} from '../lib/catalog';

type View = 'dashboard' | 'products' | 'product-new' | 'product-edit' | 'orders' | 'order' | 'categories' | 'content' | 'settings';
type Props = {view: View; productId?: string; orderId?: string};
type DashboardData = {
  products: number;
  activeProducts: number;
  customers: number;
  orders: number;
  revenue: number;
  recentOrders?: CommerceOrder[];
};

const emptyContent: CommerceContent = {
  heroEyebrow: '',
  heroTitle: '',
  heroEmphasis: '',
  heroDescription: '',
  studioCopy: '',
  shippingNote: ''
};
const emptySettings: CommerceSettings = {
  storeName: 'Vera Studio',
  currency: 'ARS',
  pickupEnabled: true,
  deliveryEnabled: true,
  deliveryFee: 0
};
const blankVariant = (): CommerceVariant => ({
  id: '',
  sku: null,
  color: 'Único',
  colorValue: '#d2c1b0',
  size: 'Único',
  stock: 0,
  active: true
});

const orderLabels: Record<CommerceOrderStatus, string> = {
  new: 'Nuevo',
  confirmed: 'Confirmado',
  packing: 'Preparando',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado'
};

const paymentLabels: Record<CommercePaymentStatus, string> = {
  pending: 'Pendiente',
  approved: 'Cobrado',
  rejected: 'Rechazado',
  refunded: 'Reembolsado'
};

const orderTone: Record<CommerceOrderStatus, string> = {
  new: 'neutral',
  confirmed: 'accent',
  packing: 'accent',
  shipped: 'info',
  delivered: 'success',
  cancelled: 'muted'
};

const paymentTone: Record<CommercePaymentStatus, string> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  refunded: 'muted'
};

const navKey = (view: View) => view === 'product-new' || view === 'product-edit' ? 'products' : view === 'order' ? 'orders' : view;
const formatDate = (value: string) => new Intl.DateTimeFormat('es-AR', {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}).format(new Date(value));
const productStock = (product: CommerceProduct) => product.variants.some(variant => variant.stock === null)
  ? 'Sin límite'
  : String(product.variants.reduce((sum, variant) => sum + (variant.stock ?? 0), 0));

function StatusBadge({label, tone}: {label: string; tone: string}) {
  return <span className={`admin-badge admin-badge--${tone}`}>{label}</span>;
}

function PageHeading({eyebrow, title, description, action}: {eyebrow: string; title: string; description?: string; action?: ReactNode}) {
  return <div className="admin-heading admin-heading--v2">
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {description && <p className="admin-heading__description">{description}</p>}
    </div>
    {action && <div className="admin-heading__action">{action}</div>}
  </div>;
}

export function AdminApp({view, productId, orderId}: Props) {
  const client = useMemo(() => {
    try { return veraClient(); } catch { return null; }
  }, []);
  const [catalog, setCatalog] = useState<CommerceCatalog | null>(null);
  const [orders, setOrders] = useState<CommerceOrder[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [content, setContent] = useState(emptyContent);
  const [settings, setSettings] = useState(emptySettings);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client) { setLoading(false); return; }
    Promise.all([
      client.commerce.admin.catalog(),
      client.commerce.admin.orders(),
      client.commerce.admin.dashboard()
    ]).then(([catalogResult, ordersResult, dashboardResult]) => {
      setCatalog(catalogResult.catalog);
      setOrders(ordersResult.orders);
      setDashboard(dashboardResult.dashboard);
    }).catch(reason => setError(reason instanceof Error ? reason.message : 'Sesión vencida.'))
      .finally(() => setLoading(false));
    client.commerce.admin.content().then(result => {
      setContent(result.content);
      setSettings(result.settings);
    }).catch(() => undefined);
  }, [client]);

  if (!client) return <main className="commerce-admin"><AdminNav view={view}/><div className="admin-main"><div className="admin-error"><h1>Falta configurar la tienda.</h1><p>Definí NEXT_PUBLIC_NADAV_CORE_URL para conectar Vera con NADAV Core.</p></div></div></main>;
  if (loading) return <main className="commerce-admin"><AdminNav view={view}/><div className="admin-main"><div className="admin-loading-card"><span/><p>Cargando administración…</p></div></div></main>;
  if (error) return <main className="commerce-admin"><AdminNav view={view}/><div className="admin-main"><div className="admin-error"><h1>No pudimos abrir el estudio.</h1><p>{error}</p><Link href="/admin/login">Volver a ingresar</Link></div></div></main>;

  const currentProduct = catalog?.products.find(product => product.id === productId);
  const currentOrder = orders.find(order => order.id === orderId);

  return <main className="commerce-admin">
    <AdminNav view={view}/>
    <div className="admin-main">
      {view === 'dashboard' && <Dashboard dashboard={dashboard} orders={orders}/>}
      {view === 'products' && <Products catalog={catalog!}/>}
      {(view === 'product-new' || view === 'product-edit') && <ProductEditor catalog={catalog!} product={currentProduct} client={client} onSaved={() => window.location.href = '/admin/productos'}/>}
      {view === 'orders' && <Orders orders={orders}/>}
      {view === 'order' && <OrderDetail order={currentOrder} client={client}/>}
      {view === 'categories' && <Categories catalog={catalog!} client={client}/>}
      {(view === 'content' || view === 'settings') && <ContentEditor content={content} settings={settings} client={client} mode={view}/>}
    </div>
  </main>;
}

function AdminNav({view}: {view: View}) {
  const active = navKey(view);
  const links = [
    {key: 'dashboard', href: '/admin', label: 'Resumen', mark: '01'},
    {key: 'products', href: '/admin/productos', label: 'Productos', mark: '02'},
    {key: 'categories', href: '/admin/categorias', label: 'Categorías', mark: '03'},
    {key: 'orders', href: '/admin/pedidos', label: 'Pedidos', mark: '04'},
    {key: 'content', href: '/admin/contenido', label: 'Contenido', mark: '05'},
    {key: 'settings', href: '/admin/configuracion', label: 'Configuración', mark: '06'}
  ];
  return <aside className="commerce-admin__nav">
    <div className="admin-brand">
      <Link href="/admin" className="admin-wordmark">VERA <i>STUDIO</i></Link>
      <span>Admin</span>
    </div>
    <nav aria-label="Administración">
      {links.map(link => <Link key={link.key} href={link.href} className={active === link.key ? 'is-active' : ''}>
        <small>{link.mark}</small><span>{link.label}</span>
      </Link>)}
    </nav>
    <div className="admin-nav__footer">
      <span>Tienda conectada</span>
      <Link href="/" className="admin-back">Ver tienda <b>↗</b></Link>
    </div>
  </aside>;
}

function Dashboard({dashboard, orders}: {dashboard: DashboardData | null; orders: CommerceOrder[]}) {
  const recent = dashboard?.recentOrders?.length ? dashboard.recentOrders.slice(0, 5) : orders.slice(0, 5);
  return <section className="admin-section">
    <PageHeading eyebrow="Vera Studio" title="Resumen" description="Una vista rápida del estado de tu tienda." action={<Link className="primary-button" href="/admin/productos/nuevo">Nueva prenda</Link>}/>
    <div className="admin-metrics admin-metrics--v2">
      <article><span>01</span><small>Cobrado</small><strong>{money(dashboard?.revenue ?? 0)}</strong><p>Pagos aprobados</p></article>
      <article><span>02</span><small>Pedidos</small><strong>{dashboard?.orders ?? 0}</strong><p>Pedidos totales</p></article>
      <article><span>03</span><small>Clientes</small><strong>{dashboard?.customers ?? 0}</strong><p>Compradores únicos</p></article>
      <article><span>04</span><small>Productos activos</small><strong>{dashboard?.activeProducts ?? 0}</strong><p>de {dashboard?.products ?? 0} productos</p></article>
    </div>
    <div className="admin-dashboard-grid">
      <section className="admin-card admin-card--flush">
        <div className="admin-card__heading"><div><p className="eyebrow">Actividad</p><h2>Pedidos recientes</h2></div><Link href="/admin/pedidos">Ver todos →</Link></div>
        <div className="admin-order-list">
          {recent.length === 0 && <p className="admin-empty">Todavía no hay pedidos.</p>}
          {recent.map(order => <Link href={`/admin/pedidos/${order.id}`} className="admin-order-row" key={order.id}>
            <div><b>#{order.number}</b><span>{order.customer.name}</span></div>
            <small>{formatDate(order.createdAt)}</small>
            <strong>{money(order.total)}</strong>
            <StatusBadge label={paymentLabels[order.paymentStatus]} tone={paymentTone[order.paymentStatus]}/>
          </Link>)}
        </div>
      </section>
      <aside className="admin-insight">
        <span className="admin-insight__mark">V</span>
        <p className="eyebrow">Catálogo conectado</p>
        <h2>Todo lo que cambia acá se refleja en tu tienda.</h2>
        <p>Precios, variantes y stock se validan en Core antes de confirmar cada pedido.</p>
        <Link href="/admin/productos">Gestionar catálogo →</Link>
      </aside>
    </div>
  </section>;
}

function Products({catalog}: {catalog: CommerceCatalog}) {
  return <section className="admin-section">
    <PageHeading eyebrow="Catálogo" title="Productos" description={`${catalog.products.length} productos cargados en tu colección.`} action={<Link className="primary-button" href="/admin/productos/nuevo">Nueva prenda</Link>}/>
    <div className="admin-card admin-card--flush">
      <div className="admin-data-head admin-products-grid"><span>Producto</span><span>Categoría</span><span>Stock</span><span>Precio</span><span>Estado</span></div>
      <div className="admin-data-list">
        {catalog.products.map(product => <Link className="admin-data-row admin-products-grid" href={`/admin/productos/${product.id}`} key={product.id}>
          <div className="admin-product-cell">
            <div className="admin-product-thumb">{product.images[0] ? <img src={product.images[0]} alt=""/> : <span>V</span>}</div>
            <div><b>{product.name}</b><small>{product.variants.length} {product.variants.length === 1 ? 'variante' : 'variantes'}</small></div>
          </div>
          <span>{catalog.categories.find(category => category.id === product.categoryId)?.name ?? 'Sin categoría'}</span>
          <span>{productStock(product)}</span>
          <strong>{money(product.price)}</strong>
          <StatusBadge label={product.active ? 'Activo' : 'Pausado'} tone={product.active ? 'success' : 'muted'}/>
        </Link>)}
      </div>
    </div>
  </section>;
}

function ProductEditor({catalog, product, client, onSaved}: {catalog: CommerceCatalog; product?: CommerceProduct; client: ReturnType<typeof veraClient>; onSaved: () => void}) {
  const [draft, setDraft] = useState<CommerceProduct>(product ?? {id: '', slug: '', categoryId: catalog.categories[0]?.id ?? '', name: '', description: '', price: 0, images: [], composition: '', care: '', active: true, variants: [blankVariant()]});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof CommerceProduct>(key: K, value: CommerceProduct[K]) => setDraft(current => ({...current, [key]: value}));
  const updateVariant = (index: number, patch: Partial<CommerceVariant>) => set('variants', draft.variants.map((variant, row) => row === index ? {...variant, ...patch} : variant));
  const uploadImage = async (file?: File) => {
    if (!file) return;
    setSaving(true); setError('');
    try { const url = await client.commerce.admin.uploadImage(file); set('images', [url]); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo subir la imagen.'); }
    finally { setSaving(false); }
  };
  const save = async () => {
    setSaving(true); setError('');
    try { await client.commerce.admin.saveProduct(draft); onSaved(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar.'); setSaving(false); }
  };

  return <section className="admin-section">
    <Link className="back-link admin-back-link" href="/admin/productos">← Productos</Link>
    <PageHeading eyebrow={product ? 'Editar producto' : 'Nuevo producto'} title={product?.name ?? 'Nueva prenda'} description="Información, imagen, variantes y disponibilidad." action={<button className="primary-button" disabled={saving || !draft.name || !draft.price} onClick={save}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>}/>
    <div className="admin-editor-grid">
      <div className="admin-editor-main">
        <section className="admin-card admin-form-card">
          <div className="admin-card__heading"><div><p className="eyebrow">Información</p><h2>Datos del producto</h2></div></div>
          <div className="admin-form">
            <label>Nombre<input value={draft.name} onChange={event => set('name', event.target.value)}/></label>
            <label>Slug<input value={draft.slug} onChange={event => set('slug', event.target.value)}/></label>
            <label>Categoría<select value={draft.categoryId} onChange={event => set('categoryId', event.target.value)}>{catalog.categories.map(category => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
            <label>Precio<input type="number" min="1" value={draft.price} onChange={event => set('price', Number(event.target.value))}/></label>
            <label className="full">Descripción<textarea value={draft.description} onChange={event => set('description', event.target.value)}/></label>
            <label>Composición<input value={draft.composition} onChange={event => set('composition', event.target.value)}/></label>
            <label>Cuidados<input value={draft.care} onChange={event => set('care', event.target.value)}/></label>
          </div>
        </section>
        <section className="admin-card admin-form-card">
          <div className="admin-card__heading"><div><p className="eyebrow">Variantes</p><h2>Talles, colores y stock</h2></div><button type="button" className="admin-secondary-button" onClick={() => set('variants', [...draft.variants, blankVariant()])}>+ Agregar variante</button></div>
          <div className="variant-editor">
            <div className="variant-row variant-row--head"><span>Color</span><span>Hex</span><span>Talle</span><span>Stock</span><span/></div>
            {draft.variants.map((variant, index) => <div className="variant-row" key={`${variant.id}-${index}`}>
              <input aria-label="Color" value={variant.color} onChange={event => updateVariant(index, {color: event.target.value})}/>
              <input aria-label="Color hex" value={variant.colorValue ?? ''} onChange={event => updateVariant(index, {colorValue: event.target.value})}/>
              <input aria-label="Talle" value={variant.size} onChange={event => updateVariant(index, {size: event.target.value})}/>
              <input aria-label="Stock" type="number" min="0" value={variant.stock ?? ''} onChange={event => updateVariant(index, {stock: event.target.value === '' ? null : Number(event.target.value)})}/>
              <button type="button" onClick={() => set('variants', draft.variants.filter((_, row) => row !== index))} aria-label="Quitar variante">×</button>
            </div>)}
          </div>
        </section>
      </div>
      <aside className="admin-editor-side">
        <section className="admin-card admin-form-card">
          <div className="admin-card__heading"><div><p className="eyebrow">Imagen</p><h2>Portada</h2></div></div>
          <div className="admin-image-preview">{draft.images[0] ? <img src={draft.images[0]} alt={draft.name || 'Producto'}/> : <span>Sin imagen</span>}</div>
          <label className="admin-file-button">Subir JPG, PNG o WebP<input type="file" accept="image/jpeg,image/png,image/webp" disabled={saving} onChange={event => void uploadImage(event.target.files?.[0])}/></label>
          <label className="admin-url-field">URL de imagen<input value={draft.images[0] ?? ''} onChange={event => set('images', event.target.value ? [event.target.value] : [])} placeholder="/images/prenda.webp"/></label>
        </section>
        <section className="admin-card admin-form-card">
          <div className="admin-card__heading"><div><p className="eyebrow">Publicación</p><h2>Disponibilidad</h2></div></div>
          <label className="admin-toggle-row"><span><b>Producto activo</b><small>Visible y comprable en la tienda.</small></span><input type="checkbox" checked={draft.active} onChange={event => set('active', event.target.checked)}/></label>
        </section>
      </aside>
    </div>
    {error && <p className="form-error admin-form-error" role="alert">{error}</p>}
  </section>;
}

function Orders({orders}: {orders: CommerceOrder[]}) {
  return <section className="admin-section">
    <PageHeading eyebrow="Operación" title="Pedidos" description={`${orders.length} pedidos registrados.`}/>
    <div className="admin-card admin-card--flush">
      <div className="admin-data-head admin-orders-grid"><span>Pedido</span><span>Fecha</span><span>Pago</span><span>Estado</span><span>Total</span></div>
      <div className="admin-data-list">
        {orders.length === 0 && <p className="admin-empty">Todavía no hay pedidos.</p>}
        {orders.map(order => <Link className="admin-data-row admin-orders-grid" href={`/admin/pedidos/${order.id}`} key={order.id}>
          <div><b>#{order.number}</b><small>{order.customer.name} · {order.items.length} {order.items.length === 1 ? 'prenda' : 'prendas'}</small></div>
          <span>{formatDate(order.createdAt)}</span>
          <StatusBadge label={paymentLabels[order.paymentStatus]} tone={paymentTone[order.paymentStatus]}/>
          <StatusBadge label={orderLabels[order.status]} tone={orderTone[order.status]}/>
          <strong>{money(order.total)}</strong>
        </Link>)}
      </div>
    </div>
  </section>;
}

function OrderDetail({order, client}: {order?: CommerceOrder; client: ReturnType<typeof veraClient>}) {
  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState('');
  if (!order) return <section className="admin-section"><PageHeading eyebrow="Pedido" title="No encontrado"/><p>No pudimos encontrar este pedido.</p></section>;

  const statuses: CommerceOrderStatus[] = ['new', 'confirmed', 'packing', 'shipped', 'delivered', 'cancelled'];
  const update = async (status: CommerceOrderStatus) => {
    if (status === order.status) return;
    setSaving(true); setMutationError('');
    try { await client.commerce.admin.updateOrder(order.id, status); window.location.reload(); }
    catch (reason) { setMutationError(reason instanceof Error ? reason.message : 'No se pudo actualizar el pedido.'); }
    finally { setSaving(false); }
  };
  const updatePayment = async (paymentStatus: CommercePaymentStatus) => {
    setSaving(true); setMutationError('');
    try { await client.commerce.admin.updatePayment(order.id, paymentStatus); window.location.reload(); }
    catch (reason) { setMutationError(reason instanceof Error ? reason.message : 'No se pudo actualizar el pago.'); }
    finally { setSaving(false); }
  };

  return <section className="admin-section">
    <Link className="back-link admin-back-link" href="/admin/pedidos">← Todos los pedidos</Link>
    <PageHeading eyebrow={`Pedido #${order.number}`} title={order.customer.name} description={formatDate(order.createdAt)} action={<StatusBadge label={orderLabels[order.status]} tone={orderTone[order.status]}/>}/>
    <div className="admin-order-layout">
      <div className="admin-order-main">
        <section className="admin-card admin-card--flush">
          <div className="admin-card__heading admin-card__heading--padded"><div><p className="eyebrow">Compra</p><h2>Productos</h2></div><span>{order.items.length} {order.items.length === 1 ? 'artículo' : 'artículos'}</span></div>
          <div className="admin-order-items">
            {order.items.map(item => <div className="admin-order-item" key={item.variantId}>
              <div className="admin-order-item__thumb">{item.image ? <img src={item.image} alt=""/> : <span>V</span>}</div>
              <div><b>{item.quantity} × {item.name}</b><small>{item.color} · {item.size}</small></div>
              <span>{money(item.unitPrice)} c/u</span>
              <strong>{money(item.lineTotal)}</strong>
            </div>)}
          </div>
          <div className="admin-order-totals">
            <div><span>Subtotal</span><b>{money(order.subtotal)}</b></div>
            <div><span>Envío</span><b>{order.deliveryFee ? money(order.deliveryFee) : 'Sin cargo'}</b></div>
            <div className="admin-order-totals__total"><span>Total</span><strong>{money(order.total)}</strong></div>
          </div>
        </section>
      </div>
      <aside className="admin-order-side">
        <section className="admin-card admin-info-card">
          <p className="eyebrow">Cliente</p>
          <h3>{order.customer.name}</h3>
          <a href={`mailto:${order.customer.email}`}>{order.customer.email}</a>
          {order.customer.phone && <a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a>}
        </section>
        <section className="admin-card admin-info-card">
          <p className="eyebrow">Entrega</p>
          <h3>{order.fulfillment === 'delivery' ? 'Envío a domicilio' : 'Retiro por el estudio'}</h3>
          {order.fulfillment === 'delivery' && <p>{order.address}<br/>{order.city}</p>}
        </section>
        <section className="admin-card admin-info-card">
          <div className="admin-info-card__top"><p className="eyebrow">Pago</p><StatusBadge label={paymentLabels[order.paymentStatus]} tone={paymentTone[order.paymentStatus]}/></div>
          <h3>Transferencia</h3>
          {order.paymentStatus === 'pending' && <button type="button" className="primary-button admin-full-button" disabled={saving} onClick={() => updatePayment('approved')}>Marcar como recibida</button>}
          {order.paymentStatus === 'approved' && <button type="button" className="admin-secondary-button admin-full-button" disabled={saving} onClick={() => updatePayment('refunded')}>Registrar reembolso</button>}
          {order.paymentStatus === 'refunded' && <p className="admin-muted-copy">El pago fue registrado como reembolsado.</p>}
        </section>
        <section className="admin-card admin-info-card">
          <div className="admin-info-card__top"><p className="eyebrow">Estado</p><StatusBadge label={orderLabels[order.status]} tone={orderTone[order.status]}/></div>
          <label className="admin-status-field">Actualizar pedido<select disabled={saving} value={order.status} onChange={event => void update(event.target.value as CommerceOrderStatus)}>{statuses.map(status => <option key={status} value={status} disabled={status === 'cancelled' && order.paymentStatus === 'approved'}>{orderLabels[status]}</option>)}</select></label>
          {order.paymentStatus === 'approved' && order.status !== 'cancelled' && <p className="admin-muted-copy">Para cancelar un pedido cobrado, registrá primero el reembolso.</p>}
        </section>
        {mutationError && <p className="form-error admin-form-error" role="alert">{mutationError}</p>}
      </aside>
    </div>
  </section>;
}

function Categories({catalog, client}: {catalog: CommerceCatalog; client: ReturnType<typeof veraClient>}) {
  const [rows, setRows] = useState(catalog.categories);
  const [saving, setSaving] = useState(false);
  const save = async (category: CommerceCategory) => {
    setSaving(true);
    try {
      const result = await client.commerce.admin.saveCategory(category);
      setRows(current => current.map(row => row.id === category.id ? result.category : row));
    } finally { setSaving(false); }
  };
  return <section className="admin-section">
    <PageHeading eyebrow="Catálogo" title="Categorías" description="Organizá cómo se agrupan las prendas en la tienda."/>
    <div className="admin-category-list">
      {rows.map((category, index) => <section className="admin-card admin-category-card" key={category.id}>
        <span className="admin-category-index">{String(index + 1).padStart(2, '0')}</span>
        <label>Nombre<input value={category.name} onChange={event => setRows(current => current.map(row => row.id === category.id ? {...row, name: event.target.value} : row))}/></label>
        <div><small>Slug</small><code>{category.slug}</code></div>
        <StatusBadge label={category.active ? 'Activa' : 'Pausada'} tone={category.active ? 'success' : 'muted'}/>
        <button className="admin-secondary-button" disabled={saving} onClick={() => save(category)}>Guardar</button>
      </section>)}
    </div>
  </section>;
}

function ContentEditor({content, settings, client, mode}: {content: CommerceContent; settings: CommerceSettings; client: ReturnType<typeof veraClient>; mode: 'content' | 'settings'}) {
  const [draft, setDraft] = useState(content);
  const [config, setConfig] = useState(settings);
  const [saved, setSaved] = useState(false);
  const save = async () => {
    await client.commerce.admin.saveContent(draft, config);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return <section className="admin-section">
    <PageHeading eyebrow={mode === 'content' ? 'Tienda pública' : 'Ajustes'} title={mode === 'content' ? 'Contenido' : 'Configuración'} description={mode === 'content' ? 'Editá los textos principales que ve el cliente.' : 'Preferencias operativas de Vera Studio.'} action={<button className="primary-button" onClick={save}>{saved ? 'Guardado ✓' : 'Guardar cambios'}</button>}/>
    {mode === 'content' ? <div className="admin-editor-grid admin-editor-grid--content">
      <section className="admin-card admin-form-card">
        <div className="admin-card__heading"><div><p className="eyebrow">Hero</p><h2>Portada de la tienda</h2></div></div>
        <div className="admin-form">
          <label>Eyebrow<input value={draft.heroEyebrow} onChange={event => setDraft({...draft, heroEyebrow: event.target.value})}/></label>
          <label>Título<input value={draft.heroTitle} onChange={event => setDraft({...draft, heroTitle: event.target.value})}/></label>
          <label>Énfasis<input value={draft.heroEmphasis} onChange={event => setDraft({...draft, heroEmphasis: event.target.value})}/></label>
          <label className="full">Descripción<textarea value={draft.heroDescription} onChange={event => setDraft({...draft, heroDescription: event.target.value})}/></label>
        </div>
      </section>
      <section className="admin-card admin-form-card">
        <div className="admin-card__heading"><div><p className="eyebrow">Marca</p><h2>Historia y envíos</h2></div></div>
        <div className="admin-form admin-form--single">
          <label>Texto del estudio<textarea value={draft.studioCopy} onChange={event => setDraft({...draft, studioCopy: event.target.value})}/></label>
          <label>Nota de envíos<input value={draft.shippingNote} onChange={event => setDraft({...draft, shippingNote: event.target.value})}/></label>
        </div>
      </section>
    </div> : <div className="admin-settings-grid">
      <section className="admin-card admin-form-card">
        <div className="admin-card__heading"><div><p className="eyebrow">General</p><h2>Tienda</h2></div></div>
        <div className="admin-form admin-form--single">
          <label>Nombre de la tienda<input value={config.storeName} onChange={event => setConfig({...config, storeName: event.target.value})}/></label>
          <label>Costo de envío<input type="number" min="0" value={config.deliveryFee} onChange={event => setConfig({...config, deliveryFee: Number(event.target.value)})}/></label>
        </div>
      </section>
      <section className="admin-card admin-form-card">
        <div className="admin-card__heading"><div><p className="eyebrow">Fulfillment</p><h2>Entrega</h2></div></div>
        <div className="admin-toggle-list">
          <label className="admin-toggle-row"><span><b>Envíos</b><small>Permitir compras con entrega a domicilio.</small></span><input type="checkbox" checked={config.deliveryEnabled} onChange={event => setConfig({...config, deliveryEnabled: event.target.checked})}/></label>
          <label className="admin-toggle-row"><span><b>Retiro</b><small>Permitir retiro por el estudio.</small></span><input type="checkbox" checked={config.pickupEnabled} onChange={event => setConfig({...config, pickupEnabled: event.target.checked})}/></label>
        </div>
      </section>
    </div>}
  </section>;
}
