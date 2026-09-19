import {createHash} from 'node:crypto';
import {asObject, commercePlaceOrder, commerceStoreBySlug, errorResponse, rpc, readJson} from '@nadav/adapters';
import {CoreError, type CommerceCheckoutInput} from '@nadav/core';

export async function POST(request: Request) {
  try {
    const body = asObject(await readJson(request));
    const store = await commerceStoreBySlug(String(body.store ?? ''));
    const key = request.headers.get('idempotency-key') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(key)) throw new CoreError('INVALID_IDEMPOTENCY_KEY', 'Falta una clave de idempotencia válida.', 400);
    const fingerprint = createHash('sha256').update(`${store.id}:${request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'}`).digest('hex');
    if (!await rpc<boolean>('core_rate_check', {p_key: `commerce-order:${fingerprint}`, p_limit: 20, p_window_seconds: 900})) throw new CoreError('RATE_LIMITED', 'Demasiados intentos. Esperá unos minutos.', 429);
    const result = await commercePlaceOrder(store.id, key, body.checkout as CommerceCheckoutInput);
    return Response.json(result, {status: result.created ? 201 : 200});
  } catch (error) { return errorResponse(error); }
}
