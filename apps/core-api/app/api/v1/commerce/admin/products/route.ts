import {asObject, commerceSaveProduct, commerceStoreBySlug, errorResponse, readJson, requireCommerceAdmin} from '@nadav/adapters';
import type {CommerceProduct} from '@nadav/core';

async function save(request: Request, created: boolean) {
  const body = asObject(await readJson(request, 500_000)); const store = await commerceStoreBySlug(String(body.store ?? ''));
  requireCommerceAdmin(request, store.id, 'editor');
  return Response.json({product: await commerceSaveProduct(store.id, body.product as CommerceProduct)}, {status: created ? 201 : 200});
}
export async function POST(request: Request) { try { return await save(request, true); } catch (error) { return errorResponse(error); } }
export async function PUT(request: Request) { try { return await save(request, false); } catch (error) { return errorResponse(error); } }
