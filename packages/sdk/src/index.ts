import type {CatalogResponse, CheckoutInput, Order, PublicOrder, Quote, CommerceCatalog, CommerceCatalogResponse, CommerceCategory, CommerceCheckoutInput, CommerceContent, CommerceOrder, CommerceOrderStatus, CommercePaymentStatus, CommerceProduct, CommerceQuote, CommerceSettings} from '@nadav/core';

export type NadavClientOptions = {baseUrl: string; restaurant: string; fetch?: typeof globalThis.fetch};
type ApiError = {error?: {code?: string; message?: string}};

export class NadavApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}

export function createNadavClient(options: NadavClientOptions) {
  const base = options.baseUrl.replace(/\/$/, '');
  const request = options.fetch ?? globalThis.fetch;
  // Public storefront calls carry no cookies; only the Commerce admin needs the session cookie.
  async function call<T>(path: string, init?: RequestInit, authenticated = false): Promise<T> {
    const response = await request(`${base}/api/v1${path}`, {...init, credentials: authenticated ? 'include' : 'omit', headers: {'Content-Type': 'application/json', ...init?.headers}});
    // A proxy or platform error page is not JSON: report the HTTP failure instead of a JSON SyntaxError.
    const data = await response.json().catch(() => ({})) as T & ApiError;
    if (!response.ok) throw new NadavApiError(response.status, data.error?.code ?? 'REQUEST_FAILED', data.error?.message ?? 'No se pudo completar la solicitud.');
    return data;
  }
  const authed = <T>(path: string, init?: RequestInit) => call<T>(path, init, true);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return {
    catalog: {get: () => call<CatalogResponse>(`/catalog?restaurant=${encodeURIComponent(options.restaurant)}`)},
    cart: {quote: (checkout: CheckoutInput) => call<{quote: Quote}>('/quote', {method: 'POST', body: JSON.stringify({restaurant: options.restaurant, checkout})})},
    // Keep the same idempotencyKey while retrying the same checkout (see apps/burgerhouse). The default creates a new key per call, so a retry would create a new order.
    checkout: {createOrder: (checkout: CheckoutInput, idempotencyKey = crypto.randomUUID()) => call<{order: Order; paymentUrl?: string}>('/orders', {method: 'POST', headers: {'Idempotency-Key': idempotencyKey}, body: JSON.stringify({restaurant: options.restaurant, checkout})})},
    orders: {get: (orderId: string) => call<{order: PublicOrder}>(`/orders/${encodeURIComponent(orderId)}?restaurant=${encodeURIComponent(options.restaurant)}`)},
    commerce: {
      catalog: () => call<CommerceCatalogResponse>(`/commerce/catalog?store=${encodeURIComponent(options.restaurant)}`),
      quote: (checkout: CommerceCheckoutInput) => call<{quote: CommerceQuote}>('/commerce/quote', {method: 'POST', body: JSON.stringify({store: options.restaurant, checkout})}),
      createOrder: (checkout: CommerceCheckoutInput, idempotencyKey = crypto.randomUUID()) => call<{order: CommerceOrder; created: boolean}>('/commerce/orders', {method: 'POST', headers: {'Idempotency-Key': idempotencyKey}, body: JSON.stringify({store: options.restaurant, checkout})}),
      admin: {
        login: (email: string, password: string) => authed<{role: string; store: {slug: string; name: string}}>('/commerce/admin/session', {method: 'POST', body: JSON.stringify({store: options.restaurant, email, password})}),
        logout: () => authed<void>('/commerce/admin/session', {method: 'POST', body: JSON.stringify({action: 'logout'})}),
        dashboard: () => authed<{dashboard: {products: number; activeProducts: number; customers: number; orders: number; revenue: number; recentOrders: CommerceOrder[]}}>(`/commerce/admin/dashboard?store=${encodeURIComponent(options.restaurant)}`),
        catalog: () => authed<{catalog: CommerceCatalog}>(`/commerce/admin/catalog?store=${encodeURIComponent(options.restaurant)}`),
        saveCategory: (category: CommerceCategory) => authed<{category: CommerceCategory}>('/commerce/admin/categories', {method: category.id ? 'PUT' : 'POST', body: JSON.stringify({store: options.restaurant, category})}),
        saveProduct: (product: CommerceProduct) => authed<{product: CommerceProduct}>('/commerce/admin/products', {method: uuid.test(product.id) ? 'PUT' : 'POST', body: JSON.stringify({store: options.restaurant, product})}),
        orders: () => authed<{orders: CommerceOrder[]}>(`/commerce/admin/orders?store=${encodeURIComponent(options.restaurant)}`),
        updateOrder: (orderId: string, status: CommerceOrderStatus) => authed<{order: CommerceOrder}>('/commerce/admin/orders', {method: 'PATCH', body: JSON.stringify({store: options.restaurant, orderId, status})}),
        updatePayment: (orderId: string, paymentStatus: CommercePaymentStatus) => authed<{order: CommerceOrder}>('/commerce/admin/orders', {method: 'PATCH', body: JSON.stringify({store: options.restaurant, orderId, paymentStatus})}),
        content: () => authed<{content: CommerceContent; settings: CommerceSettings}>(`/commerce/admin/content?store=${encodeURIComponent(options.restaurant)}`),
        saveContent: (content: CommerceContent, settings: CommerceSettings) => authed<{content: CommerceContent; settings: CommerceSettings}>('/commerce/admin/content', {method: 'PUT', body: JSON.stringify({store: options.restaurant, content, settings})}),
        uploadImage: async (file: File) => {
          const form = new FormData(); form.set('store', options.restaurant); form.set('file', file);
          const response = await request(`${base}/api/v1/commerce/admin/media`, {method: 'POST', credentials: 'include', body: form});
          const data = await response.json() as {url?: string} & ApiError;
          if (!response.ok || !data.url) throw new NadavApiError(response.status, data.error?.code ?? 'REQUEST_FAILED', data.error?.message ?? 'No se pudo subir la imagen.');
          return data.url;
        }
      }
    }
  };
}

export type NadavClient = ReturnType<typeof createNadavClient>;
