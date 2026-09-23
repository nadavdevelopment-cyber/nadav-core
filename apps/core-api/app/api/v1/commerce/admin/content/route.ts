import {asObject, commerceCatalog, commerceSaveContent, commerceStoreBySlug, errorResponse, readJson, requireCommerceAdmin} from '@nadav/adapters';
import type {CommerceContent, CommerceSettings} from '@nadav/core';

export async function GET(request: Request) {
  try { const store = await commerceStoreBySlug(new URL(request.url).searchParams.get('store') ?? ''); await requireCommerceAdmin(request, store.id); const catalog = await commerceCatalog(store.id); return Response.json({content: catalog.content, settings: catalog.settings}); } catch (error) { return errorResponse(error); }
}
export async function PUT(request: Request) {
  try { const body = asObject(await readJson(request, 60_000)); const store = await commerceStoreBySlug(String(body.store ?? '')); await requireCommerceAdmin(request, store.id, 'admin'); const catalog = await commerceSaveContent(store.id, body.content as CommerceContent, body.settings as CommerceSettings); return Response.json({content: catalog.content, settings: catalog.settings}); } catch (error) { return errorResponse(error); }
}
