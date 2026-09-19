import type {CatalogResponse, CheckoutInput, Order, Quote, CommerceCatalog, CommerceCatalogResponse, CommerceCategory, CommerceCheckoutInput, CommerceContent, CommerceOrder, CommerceOrderStatus, CommerceProduct, CommerceQuote, CommerceSettings} from '@nadav/core';

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
  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await request(`${base}/api/v1${path}`, {...init, credentials: 'include', headers: {'Content-Type': 'application/json', ...init?.headers}});
    const data = await response.json() as T & ApiError;
    if (!response.ok) throw new NadavApiError(response.status, data.error?.code ?? 'REQUEST_FAILED', data.error?.message ?? 'No se pudo completar la solicitud.');
    return data;
  }
  return {
    catalog: {get: () => call<CatalogResponse>(`/catalog?restaurant=${encodeURIComponent(options.restaurant)}`)},
    cart: {quote: (checkout: CheckoutInput) => call<{quote: Quote}>('/quote', {method: 'POST', body: JSON.stringify({restaurant: options.restaurant, checkout})})},
    checkout: {createOrder: (checkout: CheckoutInput, idempotencyKey = crypto.randomUUID()) => call<{order: Order; paymentUrl?: string}>('/orders', {method: 'POST', headers: {'Idempotency-Key': idempotencyKey}, body: JSON.stringify({restaurant: options.restaurant, checkout})})},
    orders: {get: (orderId: string) => call<{order: Order}>(`/orders/${encodeURIComponent(orderId)}?restaurant=${encodeURIComponent(options.restaurant)}`)},
    commerce: {
      catalog: () => call<CommerceCatalogResponse>(`/commerce/catalog?store=${encodeURIComponent(options.restaurant)}`),
      quote: (checkout: CommerceCheckoutInput) => call<{quote: CommerceQuote}>('/commerce/quote', {method: 'POST', body: JSON.stringify({store: options.restaurant, checkout})}),
      createOrder: (checkout: CommerceCheckoutInput, idempotencyKey = crypto.randomUUID()) => call<{order: CommerceOrder; created: boolean}>('/commerce/orders', {method: 'POST', headers: {'Idempotency-Key': idempotencyKey}, body: JSON.stringify({store: options.restaurant, checkout})}),
      admin: {
        login: (email: string, password: string) => call<{role: string; store: {slug: string; name: string}}>('/commerce/admin/session', {method: 'POST', body: JSON.stringify({store: options.restaurant, email, password})}),
        logout: () => call<void>('/commerce/admin/session', {method: 'POST', body: JSON.stringify({action: 'logout'})}),
        dashboard: () => call<{dashboard: {products: number; activeProducts: number; customers: number; orders: number; revenue: number; recentOrders: CommerceOrder[]}}>(`/commerce/admin/dashboard?store=${encodeURIComponent(options.restaurant)}`),
        catalog: () => call<{catalog: CommerceCatalog}>(`/commerce/admin/catalog?store=${encodeURIComponent(options.restaurant)}`),
        saveCategory: (category: CommerceCategory) => call<{category: CommerceCategory}>('/commerce/admin/categories', {method: category.id ? 'PUT' : 'POST', body: JSON.stringify({store: options.restaurant, category})}),
        saveProduct: (product: CommerceProduct) => call<{product: CommerceProduct}>('/commerce/admin/products', {method: /^[0-9a-f-]{36}$/i.test(product.id) ? 'PUT' : 'POST', body: JSON.stringify({store: options.restaurant, product})}),
        orders: () => call<{orders: CommerceOrder[]}>(`/commerce/admin/orders?store=${encodeURIComponent(options.restaurant)}`),
        updateOrder: (orderId: string, status: CommerceOrderStatus) => call<{order: CommerceOrder}>('/commerce/admin/orders', {method: 'PATCH', body: JSON.stringify({store: options.restaurant, orderId, status})}),
        content: () => call<{content: CommerceContent; settings: CommerceSettings}>(`/commerce/admin/content?store=${encodeURIComponent(options.restaurant)}`),
        saveContent: (content: CommerceContent, settings: CommerceSettings) => call<{content: CommerceContent; settings: CommerceSettings}>('/commerce/admin/content', {method: 'PUT', body: JSON.stringify({store: options.restaurant, content, settings})}),
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
