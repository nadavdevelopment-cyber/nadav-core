import {CoreError} from '@nadav/core';

export function assertOrigin(request: Request) {
  const configured = [process.env.APP_ORIGIN, ...(process.env.NADAV_CORE_ALLOWED_ORIGINS ?? '').split(',')].map(value => value?.trim().replace(/\/$/, '')).filter(Boolean);
  if (!configured.length) throw new CoreError('MISCONFIGURED', 'Core no está configurado.', 503);
  if (!configured.includes(request.headers.get('origin') ?? '')) throw new CoreError('INVALID_ORIGIN', 'Origen no permitido.', 403);
}

export async function readJson(request: Request, maxBytes = 40_000) {
  assertOrigin(request);
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new CoreError('PAYLOAD_TOO_LARGE', 'Solicitud demasiado grande.', 413);
  const raw = await request.text();
  if (raw.length > maxBytes) throw new CoreError('PAYLOAD_TOO_LARGE', 'Solicitud demasiado grande.', 413);
  try { return JSON.parse(raw) as unknown; } catch { throw new CoreError('INVALID_JSON', 'Datos inválidos.', 400); }
}

export function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CoreError('INVALID_INPUT', 'Datos inválidos.', 400);
  return value as Record<string, unknown>;
}

export function errorResponse(error: unknown) {
  if (error instanceof CoreError) return Response.json({error: {code: error.code, message: error.message}}, {status: error.status});
  console.error('NADAV Core request failed', error instanceof Error ? error.message : 'unknown');
  return Response.json({error: {code: 'INTERNAL', message: 'No se pudo completar la solicitud.'}}, {status: 500});
}
