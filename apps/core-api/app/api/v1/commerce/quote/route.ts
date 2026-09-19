import {asObject, commerceQuote, commerceStoreBySlug, errorResponse, readJson} from '@nadav/adapters';
import type {CommerceCheckoutInput} from '@nadav/core';

export async function POST(request: Request) {
  try {
    const body = asObject(await readJson(request));
    const store = await commerceStoreBySlug(String(body.store ?? ''));
    return Response.json({quote: await commerceQuote(store.id, body.checkout as CommerceCheckoutInput)});
  } catch (error) { return errorResponse(error); }
}
