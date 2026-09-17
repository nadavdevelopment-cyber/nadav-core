import {asObject, errorResponse, readJson, requireAdmin} from '@nadav/adapters';
import {validateCatalog, type Catalog} from '@nadav/core';
import {coreContext} from '../../../../../server/context';

export async function GET(request: Request) {
  try {
    requireAdmin(request);
    const context = await coreContext();
    return Response.json({catalog: await context.repository.catalog(context.restaurantId)});
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    requireAdmin(request);
    const body = asObject(await readJson(request, 500_000));
    const context = await coreContext();
    const catalog = validateCatalog(body.catalog as Catalog, context.restaurantId);
    const saved = await context.repository.replaceCatalog(context.restaurantId, Number(body.revision), catalog);
    return saved ? Response.json({catalog: saved}) : Response.json({error: {code: 'CONFLICT', message: 'El catálogo cambió en otra sesión.'}}, {status: 409});
  } catch (error) { return errorResponse(error); }
}
