import type {Catalog, CheckoutInput, Order, OrderStatus, Quote, RestaurantConfig} from './types.ts';

export type PlaceOrderCommand = {restaurantId: string; idempotencyKey: string; input: CheckoutInput; quote: Quote};
/** `limit` is clamped by the repository (1-100, default 50). `before` pages backwards through `createdAt` (exclusive). */
export type ListOrdersOptions = {limit?: number; before?: string};
export interface CoreRepository {
  catalog(restaurantId: string): Promise<Catalog | null>;
  placeOrder(command: PlaceOrderCommand): Promise<{order: Order; created: boolean}>;
  order(restaurantId: string, orderId: string): Promise<Order | null>;
  /** Lets the API replay an already accepted order before re-validating hours, stock or prices. */
  orderByIdempotencyKey(restaurantId: string, idempotencyKey: string): Promise<Order | null>;
  /** Most recent orders first. A restaurant with more than `limit` orders needs `options.before` to see older ones. */
  listOrders(restaurantId: string, options?: ListOrdersOptions): Promise<Order[]>;
  replaceCatalog(restaurantId: string, expectedRevision: number, catalog: Catalog): Promise<Catalog | null>;
  updateOrderStatus(restaurantId: string, orderId: string, status: OrderStatus): Promise<Order>;
  restaurantConfig(restaurantId: string): Promise<RestaurantConfig | null>;
  rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean>;
  audit(entry: {restaurantId: string; actorId?: string; action: string; details?: Record<string, unknown>}): Promise<void>;
}
