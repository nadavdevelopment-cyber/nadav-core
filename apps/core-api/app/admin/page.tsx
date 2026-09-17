import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {verifyAdminSession} from '@nadav/adapters';
import {AdminOverview, AdminShell} from '@nadav/admin-ui';
import {coreContext} from '../../server/context';

export const dynamic = 'force-dynamic';
export default async function AdminPage() {
  const session = (await cookies()).get('nadav_core_admin')?.value;
  if (!verifyAdminSession(session)) redirect('/admin/login');
  const context = await coreContext();
  const catalog = await context.repository.catalog(context.restaurantId);
  const metrics = [{label: 'Productos activos', value: String(catalog?.products.filter(product => product.available).length ?? 0)}, {label: 'Categorías', value: String(catalog?.categories.length ?? 0)}, {label: 'Promociones', value: String(catalog?.promotions.filter(promotion => promotion.active).length ?? 0)}];
  return <AdminShell restaurant={context.config.identity.name}><AdminOverview metrics={metrics}/></AdminShell>;
}
