import {createHash} from 'node:crypto';
import {clearSessionCookie, clientAddress, createAdminSession, errorResponse, sessionCookie, verifyAdminToken} from '@nadav/adapters';
import {CoreError} from '@nadav/core';
import {coreContext} from '../../../../../server/context';

export async function POST(request: Request) {
  const wantsJson = (request.headers.get('content-type') ?? '').includes('application/json');
  try {
    const origin = process.env.APP_ORIGIN?.replace(/\/$/, '') ?? new URL(request.url).origin;
    if (request.headers.get('origin') !== origin) throw new CoreError('INVALID_ORIGIN', 'Origen no permitido.', 403);
    const secure = new URL(origin).protocol === 'https:';
    let data: {token?: string; action?: string};
    try { data = wantsJson ? await request.json() as typeof data : Object.fromEntries((await request.formData()).entries()) as typeof data; } catch { throw new CoreError('INVALID_INPUT', 'Datos inválidos.', 400); }
    if (data.action === 'logout') return new Response(null, {status: 303, headers: {Location: '/admin/login', 'Set-Cookie': clearSessionCookie(secure)}});
    // The admin credential is a single static secret: cap guessing attempts per client address.
    const context = await coreContext();
    const fingerprint = createHash('sha256').update(`${context.restaurantId}:${clientAddress(request)}`).digest('hex');
    if (!await context.repository.rateLimit(`admin-login:${fingerprint}`, 10, 900)) throw new CoreError('RATE_LIMITED', 'Demasiados intentos. Esperá unos minutos.', 429);
    if (!verifyAdminToken(String(data.token ?? ''))) throw new CoreError('NO_AUTH', 'Credencial inválida.', 401);
    return new Response(null, {status: 303, headers: {Location: '/admin', 'Set-Cookie': sessionCookie(createAdminSession(), secure)}});
  } catch (error) {
    // The login page posts a plain HTML form: send the person back to it instead of showing raw JSON.
    if (!wantsJson && error instanceof CoreError && error.status < 500) return new Response(null, {status: 303, headers: {Location: `/admin/login?error=${error.code === 'RATE_LIMITED' ? 'rate' : '1'}`}});
    return errorResponse(error);
  }
}
