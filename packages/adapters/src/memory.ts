import {createOrder, notFound, transitionOrder, unavailable, type Catalog, type CoreRepository, type Order, type OrderStatus, type PlaceOrderCommand, type RestaurantConfig} from '@nadav/core';

/** In-memory repository for demos and tests. It mirrors the SQL functions (idempotency, stock, cancel) so both behave alike. */
export class MemoryCoreRepository implements CoreRepository {
  private readonly config: RestaurantConfig;
  private readonly data: Catalog;
  private orders = new Map<string, Order>();
  private counters = new Map<string, number>();
  private limits = new Map<string, {hits: number; resets: number}>();
  constructor(config: RestaurantConfig, data: Catalog) { this.config = config; this.data = data; }
  private adjustStock(items: Order['items'], direction: 1 | -1) {
    if (!this.config.features.stock) return;
    for (const item of items) {
      const product = this.data.products.find(row => row.id === item.productId);
      if (product && product.stock !== null) product.stock += direction * item.quantity;
    }
  }
  async restaurantConfig(id: string) { return id === this.data.restaurantId ? this.config : null; }
  async catalog(id: string) { return id === this.data.restaurantId ? structuredClone(this.data) : null; }
  async placeOrder(command: PlaceOrderCommand) {
    const index = `${command.restaurantId}:${command.idempotencyKey}`;
    const previous = this.orders.get(index);
    if (previous) return {order: structuredClone(previous), created: false};
    if (this.config.features.stock) {
      const requested = new Map<string, number>();
      for (const item of command.quote.items) requested.set(item.productId, (requested.get(item.productId) ?? 0) + item.quantity);
      for (const [productId, quantity] of requested) {
        const product = this.data.products.find(row => row.id === productId);
        if (!product || (product.stock !== null && product.stock < quantity)) throw unavailable('Alguno de los productos se quedó sin stock. Revisá tu carrito.');
      }
    }
    const number = (this.counters.get(command.restaurantId) ?? 1000) + 1;
    this.counters.set(command.restaurantId, number);
    const order = createOrder(command.restaurantId, number, command.idempotencyKey, command.input, command.quote);
    this.adjustStock(order.items, -1);
    this.orders.set(index, order);
    this.orders.set(`${command.restaurantId}:${order.id}`, order);
    return {order: structuredClone(order), created: true};
  }
  async order(restaurantId: string, orderId: string) { return structuredClone(this.orders.get(`${restaurantId}:${orderId}`) ?? null); }
  async orderByIdempotencyKey(restaurantId: string, key: string) { return structuredClone(this.orders.get(`${restaurantId}:${key}`) ?? null); }
  async listOrders(restaurantId: string) { return [...this.orders.entries()].filter(([key]) => key.startsWith(`${restaurantId}:`)).map(([, order]) => order).filter((order, index, rows) => rows.findIndex(candidate => candidate.id === order.id) === index).map(order => structuredClone(order)); }
  async replaceCatalog(restaurantId: string, expectedRevision: number, catalog: Catalog) {
    if (restaurantId !== this.data.restaurantId || expectedRevision !== this.data.revision) return null;
    Object.assign(this.data, structuredClone(catalog), {revision: expectedRevision + 1});
    return structuredClone(this.data);
  }
  async updateOrderStatus(restaurantId: string, orderId: string, status: OrderStatus) {
    const current = await this.order(restaurantId, orderId);
    if (!current) throw notFound('Pedido no encontrado.');
    const updated = transitionOrder(current, status);
    if (status === 'cancelled') this.adjustStock(updated.items, 1);
    this.orders.set(`${restaurantId}:${orderId}`, updated);
    this.orders.set(`${restaurantId}:${updated.idempotencyKey}`, updated);
    return structuredClone(updated);
  }
  async rateLimit(key: string, limit: number, windowSeconds: number) {
    const now = Date.now();
    const previous = this.limits.get(key);
    const next = !previous || previous.resets < now ? {hits: 1, resets: now + windowSeconds * 1000} : {...previous, hits: previous.hits + 1};
    this.limits.set(key, next);
    return next.hits <= limit;
  }
  async audit() {}
}
