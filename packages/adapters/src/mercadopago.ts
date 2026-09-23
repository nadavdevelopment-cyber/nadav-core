import {createHash, randomBytes} from 'node:crypto';
import {CoreError, type Order} from '@nadav/core';
import {openSecret, sealSecret} from './crypto.ts';
import {filterValue, rpc, supabase} from './supabase.ts';

const api = 'https://api.mercadopago.com';
export const paymentReference = (restaurantId: string, orderId: string) => `nadav-core:${restaurantId}:${orderId}`;
export const parsePaymentReference = (value: string) => {
  const id = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const match = new RegExp(`^nadav-core:(${id}):(${id})$`, 'i').exec(value);
  return match ? {restaurantId: match[1], orderId: match[2]} : null;
};

/**
 * `storefrontOrigin` is where the customer lands after paying. Core itself has no order page, so pointing back_urls
 * to the Core domain (the previous behaviour) ended in a 404: pass NADAV_CORE_STOREFRONT_URL, the storefront can read `?order=`.
 */
export function paymentPreferenceBody(order: Order, restaurantSlug: string, origin: string, storefrontOrigin: string = origin) {
  if (order.paymentMethod !== 'mercado_pago' || !Number.isSafeInteger(order.total) || order.total <= 0) throw new Error('Invalid Mercado Pago order.');
  const back = (payment: 'success' | 'pending' | 'failure') => `${storefrontOrigin}/?order=${order.id}&restaurant=${encodeURIComponent(restaurantSlug)}&payment=${payment}`;
  return {items: [{id: order.id, title: `Pedido #${order.number}`, quantity: 1, currency_id: 'ARS', unit_price: order.total}], external_reference: paymentReference(order.restaurantId, order.id), notification_url: `${origin}/api/v1/payments/mercadopago/webhook`, back_urls: {success: back('success'), pending: back('pending'), failure: back('failure')}, auto_return: 'approved'};
}

type Connection = {restaurant_id: string; mp_user_id: number; access_token_ciphertext: string; refresh_token_ciphertext: string; expires_at: string};
type TokenResponse = {access_token: string; refresh_token: string; user_id: number; expires_in: number; scope: string};
type Payment = {id: number; collector_id: number; transaction_amount: number; currency_id: string; external_reference: string; status: string; preference_id?: string};

function oauthConfig() {
  const clientId = process.env.MERCADOPAGO_CLIENT_ID;
  const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET;
  const redirectUri = process.env.MERCADOPAGO_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error('Mercado Pago OAuth is not configured.');
  return {clientId, clientSecret, redirectUri};
}

async function tokenRequest(body: Record<string, string>) {
  const response = await fetch(`${api}/oauth/token`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(10_000)});
  if (!response.ok) throw new Error(`Mercado Pago rejected the authorization (${response.status}).`);
  return response.json() as Promise<TokenResponse>;
}

export function createOAuthAttempt(restaurantId: string, userId: string, sessionHash: string) {
  const state = randomBytes(32).toString('base64url');
  const verifier = randomBytes(64).toString('base64url');
  const digest = (value: string) => createHash('sha256').update(value).digest('base64url');
  return {state, challenge: digest(verifier), row: {state_hash: digest(state), restaurant_id: restaurantId, user_id: userId, session_hash: sessionHash, code_verifier: verifier, expires_at: new Date(Date.now() + 600_000).toISOString()}};
}

export function mercadoPagoAuthorizationUrl(state: string, challenge: string) {
  const config = oauthConfig();
  const url = new URL('https://auth.mercadopago.com/authorization');
  for (const [key, value] of Object.entries({client_id: config.clientId, response_type: 'code', platform_id: 'mp', redirect_uri: config.redirectUri, state, scope: 'offline_access', code_challenge: challenge, code_challenge_method: 'S256'})) url.searchParams.set(key, value);
  return url.toString();
}

export async function saveMercadoPagoTokens(restaurantId: string, tokens: TokenResponse) {
  if (!tokens.access_token || !tokens.refresh_token || !Number.isSafeInteger(Number(tokens.user_id)) || !tokens.scope?.split(/\s+/).includes('offline_access')) throw new Error('Mercado Pago returned incomplete credentials.');
  await supabase('core_mp_connections?on_conflict=restaurant_id', {method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: {restaurant_id: restaurantId, mp_user_id: Number(tokens.user_id), access_token_ciphertext: sealSecret(tokens.access_token, restaurantId, 'mercadopago'), refresh_token_ciphertext: sealSecret(tokens.refresh_token, restaurantId, 'mercadopago'), expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), updated_at: new Date().toISOString()}});
}

async function accessToken(restaurantId: string) {
  const rows = await supabase<Connection[]>(`core_mp_connections?restaurant_id=eq.${filterValue(restaurantId)}&select=*`);
  const row = rows[0];
  if (!row) throw new Error('Mercado Pago is not connected.');
  if (new Date(row.expires_at).getTime() > Date.now() + 300_000) return {token: openSecret(row.access_token_ciphertext, restaurantId, 'mercadopago'), merchant: row.mp_user_id};
  const config = oauthConfig();
  const tokens = await tokenRequest({client_id: config.clientId, client_secret: config.clientSecret, grant_type: 'refresh_token', refresh_token: openSecret(row.refresh_token_ciphertext, restaurantId, 'mercadopago')});
  if (Number(tokens.user_id) !== row.mp_user_id) throw new Error('Mercado Pago merchant changed during refresh.');
  await saveMercadoPagoTokens(restaurantId, tokens);
  return {token: tokens.access_token, merchant: row.mp_user_id};
}

async function mp<T>(restaurantId: string, path: string, options?: {method: 'POST'; body: unknown}) {
  const credentials = await accessToken(restaurantId);
  const response = await fetch(`${api}${path}`, {method: options?.method ?? 'GET', headers: {Authorization: `Bearer ${credentials.token}`, Accept: 'application/json', ...(options ? {'Content-Type': 'application/json'} : {})}, body: options ? JSON.stringify(options.body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(12_000)});
  if (!response.ok) throw new Error(`Mercado Pago request failed (${response.status}).`);
  return {data: await response.json() as T, merchant: credentials.merchant};
}

const reservationTtlMs = 2 * 60_000;
const intentFilter = (order: Order) => `restaurant_id=eq.${filterValue(order.restaurantId)}&order_id=eq.${filterValue(order.id)}`;

export async function ensurePaymentPreference(order: Order, restaurantSlug: string) {
  if (order.paymentMethod !== 'mercado_pago' || order.total <= 0) throw new Error('Invalid Mercado Pago order.');
  const existing = await supabase<{status: string; preference_id: string | null; init_point: string | null; updated_at: string}[]>(`core_payment_intents?${intentFilter(order)}&select=status,preference_id,init_point,updated_at`);
  const intent = existing[0];
  if (intent?.preference_id && intent.init_point) return intent.init_point;
  if (intent?.status === 'creating') {
    const cutoff = new Date(Date.now() - reservationTtlMs);
    if (Date.parse(intent.updated_at) > cutoff.getTime()) throw new CoreError('PAYMENT_IN_PROGRESS', 'Estamos preparando tu pago. Reintentá en unos segundos.', 409);
    // The request that reserved the slot died before finishing (timeout, crash). Release it so the payment can be retried.
    await supabase(`core_payment_intents?${intentFilter(order)}&status=eq.creating&updated_at=lt.${filterValue(cutoff.toISOString())}`, {method: 'DELETE', prefer: 'return=minimal'});
  }
  const reserved = await supabase<unknown[]>('core_payment_intents?on_conflict=restaurant_id,order_id', {method: 'POST', prefer: 'resolution=ignore-duplicates,return=representation', body: {restaurant_id: order.restaurantId, order_id: order.id, status: 'creating'}});
  if (!reserved.length) throw new CoreError('PAYMENT_IN_PROGRESS', 'Estamos preparando tu pago. Reintentá en unos segundos.', 409);
  const origin = process.env.APP_ORIGIN?.replace(/\/$/, '');
  if (!origin) throw new Error('APP_ORIGIN is not configured.');
  const body = paymentPreferenceBody(order, restaurantSlug, origin, process.env.NADAV_CORE_STOREFRONT_URL?.replace(/\/$/, '') || origin);
  try {
    const {data, merchant} = await mp<{id: string; init_point: string; collector_id: number; external_reference: string; items: {unit_price: number}[]}>(order.restaurantId, '/checkout/preferences', {method: 'POST', body});
    const url = new URL(data.init_point);
    if (url.protocol !== 'https:' || !(url.hostname === 'mercadopago.com' || url.hostname.endsWith('.mercadopago.com') || url.hostname.endsWith('.mercadopago.com.ar')) || data.collector_id !== merchant || data.external_reference !== body.external_reference || Number(data.items?.[0]?.unit_price) !== order.total) throw new Error('Mercado Pago returned an invalid preference.');
    await supabase(`core_payment_intents?${intentFilter(order)}&status=eq.creating`, {method: 'PATCH', prefer: 'return=minimal', body: {merchant_id: merchant, preference_id: data.id, init_point: url.toString(), status: 'ready', updated_at: new Date().toISOString()}});
    return url.toString();
  } catch (error) {
    await supabase(`core_payment_intents?${intentFilter(order)}&status=eq.creating`, {method: 'DELETE', prefer: 'return=minimal'}).catch(() => undefined);
    throw error;
  }
}

export async function fetchMercadoPagoPayment(restaurantId: string, paymentId: string) {
  if (!/^\d{1,24}$/.test(paymentId)) throw new Error('Invalid payment ID.');
  return (await mp<Payment>(restaurantId, `/v1/payments/${paymentId}`)).data;
}

export async function reconcileMercadoPagoPayment(restaurantId: string, order: Order, payment: Payment) {
  const intent = await supabase<{merchant_id: number; preference_id: string}[]>(`core_payment_intents?restaurant_id=eq.${filterValue(restaurantId)}&order_id=eq.${filterValue(order.id)}&select=merchant_id,preference_id`);
  const expected = intent[0];
  if (!expected || payment.collector_id !== expected.merchant_id || payment.currency_id !== 'ARS' || payment.external_reference !== paymentReference(restaurantId, order.id) || payment.transaction_amount !== order.total || payment.preference_id !== expected.preference_id) throw new CoreError('PAYMENT_MISMATCH', 'Payment does not match order.', 422);
  return rpc<string>('core_reconcile_payment', {p_restaurant: restaurantId, p_order: order.id, p_payment: payment.id, p_status: payment.status, p_amount: payment.transaction_amount, p_external: payment.external_reference});
}

export {tokenRequest};
