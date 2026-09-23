import {CoreError, createOrder, defineRestaurantConfig, isUuid, notFound, transitionOrder, unavailable, type Catalog, type CoreRepository, type Order, type OrderStatus, type PlaceOrderCommand, type RestaurantConfig} from '@nadav/core';

type RequestOptions = {method?: string; body?: unknown; prefer?: string};

/** Failure reported by PostgREST. `detail` carries the `RAISE EXCEPTION` code of our SQL functions (e.g. OUT_OF_STOCK). */
export class DatabaseError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly detail: string;
  constructor(status: number, code: string | null, detail: string) {
    super('Database request failed.');
    this.name = 'DatabaseError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

/** Encodes a value for use inside a PostgREST filter (`column=eq.<value>`). Never interpolate raw input. */
export const filterValue = (value: string | number) => encodeURIComponent(String(value));

export async function supabase<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase is not configured.');
  const response = await fetch(`${url}/rest/v1/${path}`, {method: options.method ?? 'GET', headers: {apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: options.prefer ?? 'return=representation'}, body: options.body === undefined ? undefined : JSON.stringify(options.body), cache: 'no-store', signal: AbortSignal.timeout(12_000)});
  const text = await response.text();
  if (!response.ok) {
    let code: string | null = null;
    let detail = '';
    try { const parsed = JSON.parse(text) as {code?: unknown; message?: unknown}; code = typeof parsed.code === 'string' ? parsed.code : null; detail = typeof parsed.message === 'string' ? parsed.message.slice(0, 200) : ''; } catch { /* non-JSON error body */ }
    console.error('Supabase request failed', response.status, code, detail);
    throw new DatabaseError(response.status, code, detail);
  }
  return text ? JSON.parse(text) as T : undefined as T;
}

export const rpc = <T>(name: string, body: Record<string, unknown>) => supabase<T>(`rpc/${name}`, {method: 'POST', body});

const isDatabaseError = (error: unknown, ...details: string[]): error is DatabaseError => error instanceof DatabaseError && details.includes(error.detail);

/** Turns the exceptions raised by `core_place_order` into stable, client-safe errors. */
function placeOrderError(error: unknown) {
  if (isDatabaseError(error, 'OUT_OF_STOCK')) return unavailable('Alguno de los productos se quedó sin stock. Revisá tu carrito.');
  if (isDatabaseError(error, 'PRODUCT_UNAVAILABLE', 'INVALID_MODIFIER', 'INVALID_PROMOTION')) return unavailable('El menú cambió mientras armabas tu pedido. Revisá tu carrito.');
  if (isDatabaseError(error, 'PRICE_MISMATCH', 'SUBTOTAL_MISMATCH', 'TOTAL_MISMATCH', 'INVALID_MODIFIER_SELECTION')) return new CoreError('CATALOG_CHANGED', 'Los precios cambiaron mientras armabas tu pedido. Revisá tu carrito.', 409);
  return error;
}

type RestaurantRow = {id: string; config: RestaurantConfig};
type CatalogRow = {restaurant_id: string; revision: number; data: Omit<Catalog, 'restaurantId' | 'revision'>};

export class SupabaseCoreRepository implements CoreRepository {
  async restaurantConfig(id: string) {
    const rows = await supabase<RestaurantRow[]>(`core_restaurants?id=eq.${filterValue(id)}&active=eq.true&select=id,config`);
    // Validate what the database returns: a malformed config should fail loudly here, not as a TypeError deep in pricing.
    return rows[0] ? defineRestaurantConfig(rows[0].config) : null;
  }
  async catalog(id: string) {
    const rows = await supabase<CatalogRow[]>(`core_catalog_state?restaurant_id=eq.${filterValue(id)}&select=*`);
    const row = rows[0];
    return row ? {restaurantId: id, revision: row.revision, ...row.data} : null;
  }
  async placeOrder(command: PlaceOrderCommand) {
    const provisional = createOrder(command.restaurantId, 0, command.idempotencyKey, command.input, command.quote);
    try {
      return await rpc<{order: Order; created: boolean}>('core_place_order', {p_restaurant: command.restaurantId, p_key: command.idempotencyKey, p_order: provisional});
    } catch (error) { throw placeOrderError(error); }
  }
  async order(restaurantId: string, orderId: string) {
    if (!isUuid(orderId)) return null;
    const rows = await supabase<{data: Order}[]>(`core_orders?restaurant_id=eq.${filterValue(restaurantId)}&id=eq.${filterValue(orderId)}&select=data`);
    return rows[0]?.data ?? null;
  }
  async orderByIdempotencyKey(restaurantId: string, key: string) {
    if (!isUuid(key)) return null;
    const rows = await supabase<{data: Order}[]>(`core_orders?restaurant_id=eq.${filterValue(restaurantId)}&idempotency_key=eq.${filterValue(key)}&select=data`);
    return rows[0]?.data ?? null;
  }
  async listOrders(restaurantId: string) {
    const rows = await supabase<{data: Order}[]>(`core_orders?restaurant_id=eq.${filterValue(restaurantId)}&select=data&order=created_at.desc&limit=500`);
    return rows.map(row => row.data);
  }
  async replaceCatalog(restaurantId: string, expectedRevision: number, catalog: Catalog) {
    const rows = await supabase<CatalogRow[]>(`core_catalog_state?restaurant_id=eq.${filterValue(restaurantId)}&revision=eq.${filterValue(expectedRevision)}`, {method: 'PATCH', body: {revision: expectedRevision + 1, data: {categories: catalog.categories, products: catalog.products, promotions: catalog.promotions, deliveryZones: catalog.deliveryZones}, updated_at: new Date().toISOString()}});
    const row = rows[0];
    return row ? {restaurantId, revision: row.revision, ...row.data} : null;
  }
  /**
   * Compare-and-set in SQL (`core_update_order_status`): the row is locked, the expected status is verified, only
   * `status` is touched inside `data` (a concurrent payment update is not overwritten) and cancelling returns the stock.
   */
  async updateOrderStatus(restaurantId: string, orderId: string, status: OrderStatus) {
    const order = await this.order(restaurantId, orderId);
    if (!order) throw notFound('Pedido no encontrado.');
    transitionOrder(order, status);
    try {
      return await rpc<Order>('core_update_order_status', {p_restaurant: restaurantId, p_order: orderId, p_expected: order.status, p_status: status});
    } catch (error) {
      if (isDatabaseError(error, 'ORDER_CONFLICT')) throw new CoreError('CONFLICT', 'El pedido cambió en otra sesión. Actualizá e intentá de nuevo.', 409);
      if (isDatabaseError(error, 'ORDER_NOT_FOUND')) throw notFound('Pedido no encontrado.');
      throw error;
    }
  }
  rateLimit(key: string, limit: number, windowSeconds: number) { return rpc<boolean>('core_rate_check', {p_key: key, p_limit: limit, p_window_seconds: windowSeconds}); }
  async audit(entry: {restaurantId: string; actorId?: string; action: string; details?: Record<string, unknown>}) {
    await supabase('core_audit', {method: 'POST', prefer: 'return=minimal', body: {restaurant_id: entry.restaurantId, actor_id: entry.actorId ?? null, action: entry.action, details: entry.details ?? {}}});
  }
}
