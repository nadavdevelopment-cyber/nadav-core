import {commerceDashboard, commerceStoreBySlug, errorResponse, requireCommerceAdmin} from '@nadav/adapters';

export async function GET(request: Request) {
  try {
    const store = await commerceStoreBySlug(new URL(request.url).searchParams.get('store') ?? '');
    await requireCommerceAdmin(request, store.id);
    return Response.json({dashboard: await commerceDashboard(store.id)});
  } catch (error) { return errorResponse(error); }
}
