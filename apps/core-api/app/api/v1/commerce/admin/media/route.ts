import {assertOrigin, commerceStoreBySlug, errorResponse, requireCommerceAdmin, uploadMedia} from '@nadav/adapters';
import {CoreError} from '@nadav/core';

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const form = await request.formData(); const store = await commerceStoreBySlug(String(form.get('store') ?? ''));
    requireCommerceAdmin(request, store.id, 'editor');
    const file = form.get('file');
    if (!(file instanceof File)) throw new CoreError('INVALID_INPUT', 'Elegí una imagen.', 400);
    return Response.json(await uploadMedia(store.id, 'product', new Uint8Array(await file.arrayBuffer())), {status: 201});
  } catch (error) { return errorResponse(error); }
}
