import {createOrder, transitionOrder, type Catalog, type CoreRepository, type Order, type OrderStatus, type PlaceOrderCommand, type RestaurantConfig} from '@nadav/core';

type RequestOptions = {method?: string; body?: unknown; prefer?: string};
export async function supabase<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase is not configured.');
  const response = await fetch(`${url}/rest/v1/${path}`, {method: options.method ?? 'GET', headers: {apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: options.prefer ?? 'return=representation'}, body: options.body === undefined ? undefined : JSON.stringify(options.body), cache: 'no-store', signal: AbortSignal.timeout(12_000)});
  const text = await response.text();
  if (!response.ok) { console.error('Supabase request failed', response.status); throw new Error('Database request failed.'); }
  return text ? JSON.parse(text) as T : undefined as T;
}

export const rpc = <T>(name: string, body: Record<string, unknown>) => supabase<T>(`rpc/${name}`, {method: 'POST', body});
type RestaurantRow = {id: string; config: RestaurantConfig};
type CatalogRow = {restaurant_id: string; revision: number; data: Omit<Catalog, 'restaurantId' | 'revision'>};

export class SupabaseCoreRepository implements CoreRepository {
  async restaurantConfig(id: string) {
    const rows = await supabase<RestaurantRow[]>(`core_restaurants?id=eq.${id}&active=eq.true&select=id,config`);
    return rows[0]?.config ?? null;
  }
  async catalog(id: string) {
    const rows = await supabase<CatalogRow[]>(`core_catalog_state?restaurant_id=eq.${id}&select=*`);
    const row = rows[0];
    return row ? {restaurantId: id, revision: row.revision, ...row.data} : null;
  }
  async placeOrder(command: PlaceOrderCommand) {
    const provisional = createOrder(command.restaurantId, 0, command.idempotencyKey, command.input, command.quote);
    const result = await rpc<{order: Order; created: boolean}>('core_place_order', {p_restaurant: command.restaurantId, p_key: command.idempotencyKey, p_order: provisional});
    return result;
  }
  async order(restaurantId: string, orderId: string) {
    const rows = await supabase<{data: Order}[]>(`core_orders?restaurant_id=eq.${restaurantId}&id=eq.${orderId}&select=data`);
    return rows[0]?.data ?? null;
  }
  async listOrders(restaurantId: string) {
    const rows = await supabase<{data: Order}[]>(`core_orders?restaurant_id=eq.${restaurantId}&select=data&order=created_at.desc&limit=500`);
    return rows.map(row => row.data);
  }
  async replaceCatalog(restaurantId: string, expectedRevision: number, catalog: Catalog) {
    const rows = await supabase<CatalogRow[]>(`core_catalog_state?restaurant_id=eq.${restaurantId}&revision=eq.${expectedRevision}`, {method: 'PATCH', body: {revision: expectedRevision + 1, data: {categories: catalog.categories, products: catalog.products, promotions: catalog.promotions, deliveryZones: catalog.deliveryZones}, updated_at: new Date().toISOString()}});
    const row = rows[0];
    return row ? {restaurantId, revision: row.revision, ...row.data} : null;
  }
  async updateOrderStatus(restaurantId: string, orderId: string, status: OrderStatus) {
    const order = await this.order(restaurantId, orderId);
    if (!order) throw new Error('Order not found.');
    const updated = transitionOrder(order, status);
    const rows = await supabase<{data: Order}[]>(`core_orders?restaurant_id=eq.${restaurantId}&id=eq.${orderId}`, {method: 'PATCH', body: {status, data: updated}});
    if (rows.length !== 1) throw new Error('Order update conflict.');
    return rows[0].data;
  }
  rateLimit(key: string, limit: number, windowSeconds: number) { return rpc<boolean>('core_rate_check', {p_key: key, p_limit: limit, p_window_seconds: windowSeconds}); }
  async audit(entry: {restaurantId: string; actorId?: string; action: string; details?: Record<string, unknown>}) {
    await supabase('core_audit', {method: 'POST', prefer: 'return=minimal', body: {restaurant_id: entry.restaurantId, actor_id: entry.actorId ?? null, action: entry.action, details: entry.details ?? {}}});
  }
}
