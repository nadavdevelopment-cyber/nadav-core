import type {CatalogResponse, CheckoutInput, Order, Quote} from '@nadav/core';

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
    const response = await request(`${base}/api/v1${path}`, {...init, headers: {'Content-Type': 'application/json', ...init?.headers}});
    const data = await response.json() as T & ApiError;
    if (!response.ok) throw new NadavApiError(response.status, data.error?.code ?? 'REQUEST_FAILED', data.error?.message ?? 'No se pudo completar la solicitud.');
    return data;
  }
  return {
    catalog: {get: () => call<CatalogResponse>(`/catalog?restaurant=${encodeURIComponent(options.restaurant)}`)},
    cart: {quote: (checkout: CheckoutInput) => call<{quote: Quote}>('/quote', {method: 'POST', body: JSON.stringify({restaurant: options.restaurant, checkout})})},
    checkout: {createOrder: (checkout: CheckoutInput, idempotencyKey = crypto.randomUUID()) => call<{order: Order; paymentUrl?: string}>('/orders', {method: 'POST', headers: {'Idempotency-Key': idempotencyKey}, body: JSON.stringify({restaurant: options.restaurant, checkout})})},
    orders: {get: (orderId: string) => call<{order: Order}>(`/orders/${encodeURIComponent(orderId)}?restaurant=${encodeURIComponent(options.restaurant)}`)}
  };
}

export type NadavClient = ReturnType<typeof createNadavClient>;
