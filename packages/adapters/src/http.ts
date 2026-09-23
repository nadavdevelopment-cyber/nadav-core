import {CoreError} from '@nadav/core';

type OriginOptions = {
  /** Only APP_ORIGIN is accepted. Use it for the dedicated admin, which is served from the Core domain itself, so that storefront origins can never drive it. */
  adminOnly?: boolean;
};

function allowedOrigins({adminOnly = false}: OriginOptions = {}) {
  const values = adminOnly ? [process.env.APP_ORIGIN] : [process.env.APP_ORIGIN, ...(process.env.NADAV_CORE_ALLOWED_ORIGINS ?? '').split(',')];
  return values.map(value => value?.trim().replace(/\/$/, '')).filter((value): value is string => Boolean(value));
}

export function assertOrigin(request: Request, options: OriginOptions = {}) {
  const configured = allowedOrigins(options);
  if (!configured.length) throw new CoreError('MISCONFIGURED', 'Core no está configurado.', 503);
  if (!configured.includes(request.headers.get('origin') ?? '')) throw new CoreError('INVALID_ORIGIN', 'Origen no permitido.', 403);
}

export async function readJson(request: Request, maxBytes = 40_000, options: OriginOptions = {}) {
  assertOrigin(request, options);
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new CoreError('PAYLOAD_TOO_LARGE', 'Solicitud demasiado grande.', 413);
  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) throw new CoreError('PAYLOAD_TOO_LARGE', 'Solicitud demasiado grande.', 413);
  try { return JSON.parse(raw) as unknown; } catch { throw new CoreError('INVALID_JSON', 'Datos inválidos.', 400); }
}

export function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CoreError('INVALID_INPUT', 'Datos inválidos.', 400);
  return value as Record<string, unknown>;
}

/** First hop of X-Forwarded-For. Only trustworthy behind a proxy that overwrites the header (Vercel, Cloudflare, etc.). */
export function clientAddress(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

export function errorResponse(error: unknown) {
  if (error instanceof CoreError) return Response.json({error: {code: error.code, message: error.message}}, {status: error.status});
  if (error instanceof Error && error.name === 'TimeoutError') {
    console.error('NADAV Core upstream timeout');
    return Response.json({error: {code: 'UPSTREAM_TIMEOUT', message: 'El servicio tardó demasiado en responder. Intentá de nuevo.'}}, {status: 504});
  }
  console.error('NADAV Core request failed', error instanceof Error ? error.stack ?? error.message : 'unknown');
  return Response.json({error: {code: 'INTERNAL', message: 'No se pudo completar la solicitud.'}}, {status: 500});
}
