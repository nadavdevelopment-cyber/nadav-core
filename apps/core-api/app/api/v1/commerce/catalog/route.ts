import {commerceCatalog, commerceStoreBySlug, errorResponse} from '@nadav/adapters';

export async function GET(request: Request) {
  try {
    const store = await commerceStoreBySlug(new URL(request.url).searchParams.get('store') ?? '');
    const catalog = await commerceCatalog(store.id);
    return Response.json({store: {slug: store.slug, name: store.name}, catalog: {...catalog, categories: catalog.categories.filter(category => category.active), products: catalog.products.filter(product => product.active).map(product => ({...product, variants: product.variants.filter(variant => variant.active)}))}}, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) { return errorResponse(error); }
}
