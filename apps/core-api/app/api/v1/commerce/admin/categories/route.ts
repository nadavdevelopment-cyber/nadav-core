import {asObject, commerceSaveCategory, commerceStoreBySlug, errorResponse, readJson, requireCommerceAdmin} from '@nadav/adapters';
import type {CommerceCategory} from '@nadav/core';

export async function POST(request: Request) {
  try {
    const body = asObject(await readJson(request)); const store = await commerceStoreBySlug(String(body.store ?? ''));
    await requireCommerceAdmin(request, store.id, 'admin');
    return Response.json({category: await commerceSaveCategory(store.id, body.category as CommerceCategory)}, {status: 201});
  } catch (error) { return errorResponse(error); }
}
export const PUT = POST;
