import { NextRequest, NextResponse } from 'next/server';

function getAllowedOrigins() {
  return [
    process.env.APP_ORIGIN,
    ...(process.env.NADAV_CORE_ALLOWED_ORIGINS ?? '').split(','),
  ]
    .map(value => value?.trim().replace(/\/$/, ''))
    .filter(Boolean) as string[];
}

function applyCors(response: NextResponse, origin: string | null) {
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }

  response.headers.set('Vary', 'Origin');
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Idempotency-Key',
  );

  return response;
}

export function proxy(request: NextRequest) {
  const rawOrigin = request.headers.get('origin');
  const origin = rawOrigin?.replace(/\/$/, '') ?? null;
  const allowedOrigins = getAllowedOrigins();

  if (origin && !allowedOrigins.includes(origin)) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_ORIGIN',
          message: 'Origen no permitido.',
        },
      },
      { status: 403 },
    );
  }

  if (request.method === 'OPTIONS') {
    return applyCors(new NextResponse(null, { status: 204 }), origin);
  }

  return applyCors(NextResponse.next(), origin);
}

export const config = {
  matcher: '/api/:path*',
};
