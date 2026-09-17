import type {Catalog, CheckoutInput, Order, OrderStatus, Quote, RestaurantConfig} from './types.ts';

export type PlaceOrderCommand = {restaurantId: string; idempotencyKey: string; input: CheckoutInput; quote: Quote};
export interface CoreRepository {
  catalog(restaurantId: string): Promise<Catalog | null>;
  placeOrder(command: PlaceOrderCommand): Promise<{order: Order; created: boolean}>;
  order(restaurantId: string, orderId: string): Promise<Order | null>;
  listOrders(restaurantId: string): Promise<Order[]>;
  replaceCatalog(restaurantId: string, expectedRevision: number, catalog: Catalog): Promise<Catalog | null>;
  updateOrderStatus(restaurantId: string, orderId: string, status: OrderStatus): Promise<Order>;
  restaurantConfig(restaurantId: string): Promise<RestaurantConfig | null>;
  rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean>;
  audit(entry: {restaurantId: string; actorId?: string; action: string; details?: Record<string, unknown>}): Promise<void>;
}
