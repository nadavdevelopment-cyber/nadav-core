import type {ReactNode} from 'react';

const groups = [
  {label: 'OPERACIÓN', items: ['Inicio', 'Pedidos']},
  {label: 'MENÚ', items: ['Productos', 'Categorías', 'Imágenes', 'Stock']},
  {label: 'CRECIMIENTO', items: ['Clientes', 'Promociones', 'Analytics']},
  {label: 'NEGOCIO', items: ['Delivery y horarios', 'Pagos', 'PrintNode', 'Configuración']}
];

export function AdminShell({restaurant, children}: {restaurant: string; children: ReactNode}) {
  return <div className="admin-shell">
    <aside><div className="admin-brand"><span>N</span><div><b>{restaurant}</b><small>NADAV Core</small></div></div><nav>{groups.map(group => <section key={group.label}><h2>{group.label}</h2>{group.items.map((item, index) => <a className={group.label === 'OPERACIÓN' && index === 0 ? 'active' : ''} href={`#${item.toLowerCase().replaceAll(' ', '-')}`} key={item}>{item}</a>)}</section>)}</nav><form action="/api/v1/admin/session" method="post"><input type="hidden" name="action" value="logout"/><button>Cerrar sesión</button></form></aside>
    <main>{children}</main>
  </div>;
}

export function AdminOverview({metrics}: {metrics: {label: string; value: string}[]}) {
  return <><header className="admin-heading"><p>RESUMEN OPERATIVO</p><h1>Todo listo para trabajar.</h1><span>Datos de la instalación dedicada</span></header><section className="admin-metrics">{metrics.map(metric => <article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></article>)}</section><section className="admin-panel"><h2>Infraestructura común</h2><p>Este panel reutilizable administra la operación. El storefront puede tener cualquier diseño y vive como aplicación independiente.</p><div className="status-grid">{['Catálogo y stock', 'Pedidos e idempotencia', 'Mercado Pago', 'PrintNode', 'Clientes y promociones', 'Auditoría y rate limits'].map(item => <span key={item}>✓ {item}</span>)}</div></section></>;
}
