export type Money = number;
export type FulfillmentMode = 'pickup' | 'delivery';
export type PaymentMethod = 'cash' | 'transfer' | 'mercado_pago';
export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'refunded';
export type OrderStatus = 'new' | 'confirmed' | 'preparing' | 'ready' | 'on_the_way' | 'delivered' | 'cancelled';

export type DayHours = {open: boolean; from: string; to: string};
export type RestaurantFeatures = {
  delivery: boolean;
  pickup: boolean;
  mercadoPago: boolean;
  cash: boolean;
  transfer: boolean;
  stock: boolean;
  promotions: boolean;
  customers: boolean;
  analytics: boolean;
  printNode: boolean;
};

export type RestaurantConfig = {
  identity: {
    slug: string;
    name: string;
    tagline?: string;
    locale: string;
    currency: 'ARS';
    timeZone: string;
  };
  ordering: {
    pickup: boolean;
    delivery: boolean;
    minimumOrder: Money;
    baseDeliveryFee: Money;
  };
  payments: {cash: boolean; transfer: boolean; mercadoPago: boolean};
  printing: {printNode: boolean; paper: '58' | '80'};
  features: RestaurantFeatures;
  hours: Record<string, DayHours>;
};

export type Category = {id: string; name: string; position: number};
export type ModifierOption = {id: string; name: string; price: Money; available: boolean};
export type ModifierGroup = {id: string; name: string; min: number; max: number; options: ModifierOption[]};
export type Product = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: Money;
  promotionalPrice?: Money | null;
  image?: string;
  available: boolean;
  stock: number | null;
  modifierGroups: ModifierGroup[];
};
export type Promotion = {
  id: string;
  name: string;
  code?: string;
  type: 'percentage' | 'fixed';
  value: number;
  productIds: string[];
  active: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
};
export type DeliveryZone = {id: string; name: string; fee: Money; active: boolean};
export type Catalog = {restaurantId: string; revision: number; categories: Category[]; products: Product[]; promotions: Promotion[]; deliveryZones: DeliveryZone[]};

export type CartSelection = {groupId: string; optionId: string};
export type CartItemInput = {productId: string; quantity: number; selections: CartSelection[]; notes?: string};
export type CheckoutInput = {
  items: CartItemInput[];
  customer: {name: string; phone: string; email?: string};
  mode: FulfillmentMode;
  paymentMethod: PaymentMethod;
  address?: string;
  deliveryZoneId?: string;
  promotionCode?: string;
  notes?: string;
};
export type PricedModifier = {groupId: string; groupName: string; optionId: string; name: string; price: Money};
export type PricedItem = {productId: string; name: string; unitPrice: Money; quantity: number; modifiers: PricedModifier[]; notes: string; lineTotal: Money};
export type Quote = {items: PricedItem[]; subtotal: Money; discount: Money; deliveryFee: Money; total: Money; currency: 'ARS'};
export type Order = Quote & {
  id: string;
  restaurantId: string;
  number: number;
  idempotencyKey: string;
  customer: CheckoutInput['customer'];
  mode: FulfillmentMode;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  address: string;
  deliveryZoneId?: string;
  promotionCode?: string;
  notes: string;
  createdAt: string;
};

export type CatalogResponse = {
  restaurant: RestaurantConfig['identity'] & {features: RestaurantFeatures};
  catalog: Catalog;
  ordering: RestaurantConfig['ordering'];
  payments: RestaurantConfig['payments'];
};
