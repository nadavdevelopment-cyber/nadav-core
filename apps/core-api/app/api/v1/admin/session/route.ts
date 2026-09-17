import {clearSessionCookie, createAdminSession, sessionCookie, verifyAdminToken} from '@nadav/adapters';

export async function POST(request: Request) {
  const origin = process.env.APP_ORIGIN?.replace(/\/$/, '') ?? new URL(request.url).origin;
  if (request.headers.get('origin') !== origin) return Response.json({error: 'Invalid origin.'}, {status: 403});
  const secure = new URL(origin).protocol === 'https:';
  const type = request.headers.get('content-type') ?? '';
  const data = type.includes('application/json') ? await request.json() as {token?: string; action?: string} : Object.fromEntries((await request.formData()).entries()) as {token?: string; action?: string};
  if (data.action === 'logout') return new Response(null, {status: 303, headers: {Location: '/admin/login', 'Set-Cookie': clearSessionCookie(secure)}});
  if (!verifyAdminToken(String(data.token ?? ''))) return Response.json({error: 'Credencial inválida.'}, {status: 401});
  return new Response(null, {status: 303, headers: {Location: '/admin', 'Set-Cookie': sessionCookie(createAdminSession(), secure)}});
}
