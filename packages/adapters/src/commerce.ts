import {createCommerceOrder, isUuid, quoteCommerceCheckout, transitionCommerceOrder, type CommerceCatalog, type CommerceCategory, type CommerceCheckoutInput, type CommerceContent, type CommerceOrder, type CommerceOrderStatus, type CommerceProduct, type CommerceRole, type CommerceSettings, type CommerceVariant, validateCommerceProduct} from '@nadav/core';
import {CoreError} from '@nadav/core';
import {DatabaseError, rpc, supabase} from './supabase.ts';

type RestaurantRow = {id: string; slug: string; name: string; active: boolean};
type CategoryRow = {id: string; slug: string; name: string; position: number; active: boolean};
type ProductRow = {id: string; slug: string; category_id: string; name: string; description: string; price: number; images: string[]; composition: string; care: string; active: boolean};
type VariantRow = {id: string; product_id: string; sku: string | null; color: string; color_value: string | null; size: string; stock: number | null; active: boolean};
type ContentRow = {content: CommerceContent; settings: CommerceSettings};
type MemberRow = {role: CommerceRole};

const select = encodeURIComponent('id,slug,name,position,active');
const filter = (value: string) => encodeURIComponent(value);

export async function commerceStoreBySlug(slug: string) {
  if (!/^[a-z][a-z0-9-]{2,49}$/.test(slug)) throw new CoreError('NOT_FOUND', 'Tienda no encontrada.', 404);
  const rows = await supabase<RestaurantRow[]>(`core_restaurants?slug=eq.${filter(slug)}&active=eq.true&select=id,slug,name,active`);
  const store = rows[0];
  if (!store) throw new CoreError('NOT_FOUND', 'Tienda no encontrada.', 404);
  return store;
}

export async function commerceCatalog(restaurantId: string): Promise<CommerceCatalog> {
  // One SQL function returns the whole catalog: fewer round trips, and no silent cut at PostgREST's max-rows (1000 by default).
  const data = await rpc<Omit<CommerceCatalog, 'restaurantId'> | null>('core_commerce_catalog', {p_restaurant: restaurantId});
  if (!data?.content) throw new CoreError('NOT_FOUND', 'Commerce no está configurado.', 404);
  return {restaurantId, ...data};
}

export async function commerceQuote(restaurantId: string, input: CommerceCheckoutInput) { return quoteCommerceCheckout(await commerceCatalog(restaurantId), input); }

export async function commercePlaceOrder(restaurantId: string, key: string, input: CommerceCheckoutInput) {
  const quote = await commerceQuote(restaurantId, input);
  const provisional = createCommerceOrder(restaurantId, 0, key, input, quote);
  try {
    return await rpc<{order: CommerceOrder; created: boolean}>('core_commerce_place_order', {p_restaurant: restaurantId, p_key: key, p_input: {items: input.items, customer: input.customer, fulfillment: input.fulfillment, address: input.address, city: input.city, paymentMethod: input.paymentMethod, requestId: provisional.id}});
  } catch (error) {
    if (error instanceof DatabaseError && error.detail === 'OUT_OF_STOCK') throw new CoreError('UNAVAILABLE', 'Alguna prenda se quedó sin stock. Revisá tu carrito.', 409);
    if (error instanceof DatabaseError && ['PRODUCT_UNAVAILABLE', 'VARIANT_UNAVAILABLE'].includes(error.detail)) throw new CoreError('UNAVAILABLE', 'Una prenda ya no está disponible. Revisá tu carrito.', 409);
    throw error;
  }
}

export async function commerceMemberRole(restaurantId: string, userId: string) {
  const rows = await supabase<MemberRow[]>(`core_commerce_members?restaurant_id=eq.${filter(restaurantId)}&user_id=eq.${filter(userId)}&select=role`);
  return rows[0]?.role ?? null;
}

export async function commerceListOrders(restaurantId: string) {
  const rows = await supabase<{data: CommerceOrder}[]>(`core_commerce_orders?restaurant_id=eq.${filter(restaurantId)}&select=data&order=created_at.desc&limit=500`);
  return rows.map(row => row.data);
}
export async function commerceOrder(restaurantId: string, orderId: string) {
  const rows = await supabase<{data: CommerceOrder}[]>(`core_commerce_orders?restaurant_id=eq.${filter(restaurantId)}&id=eq.${filter(orderId)}&select=data`);
  return rows[0]?.data ?? null;
}
export async function commerceUpdateOrder(restaurantId: string, orderId: string, status: CommerceOrderStatus) {
  const order = isUuid(orderId) ? await commerceOrder(restaurantId, orderId) : null;
  if (!order) throw new CoreError('NOT_FOUND', 'Pedido no encontrado.', 404);
  transitionCommerceOrder(order, status);
  try {
    // Compare-and-set inside SQL; cancelling also gives the reserved stock back to the variants.
    return await rpc<CommerceOrder>('core_commerce_update_order_status', {p_restaurant: restaurantId, p_order: orderId, p_expected: order.status, p_status: status});
  } catch (error) {
    if (error instanceof DatabaseError && error.detail === 'ORDER_CONFLICT') throw new CoreError('CONFLICT', 'El pedido cambió en otra sesión. Actualizá e intentá de nuevo.', 409);
    throw error;
  }
}

export async function commerceSaveCategory(restaurantId: string, category: Omit<CommerceCategory, 'id'> & {id?: string}) {
  if (typeof category?.slug !== 'string' || !/^[a-z0-9][a-z0-9-]{1,79}$/.test(category.slug) || typeof category.name !== 'string' || !category.name.trim() || category.name.length > 100 || !Number.isInteger(category.position) || (category.id !== undefined && !isUuid(category.id))) throw new CoreError('INVALID_INPUT', 'La categoría no es válida.', 400);
  const body = {slug: category.slug.trim(), name: category.name.trim(), position: category.position, active: Boolean(category.active), updated_at: new Date().toISOString()};
  if (category.id) {
    const rows = await supabase<CategoryRow[]>(`core_commerce_categories?restaurant_id=eq.${filter(restaurantId)}&id=eq.${filter(category.id)}`, {method: 'PATCH', body});
    if (!rows[0]) throw new CoreError('NOT_FOUND', 'Categoría no encontrada.', 404);
    return {id: rows[0].id, slug: rows[0].slug, name: rows[0].name, position: rows[0].position, active: rows[0].active};
  }
  const rows = await supabase<CategoryRow[]>('core_commerce_categories', {method: 'POST', body: {restaurant_id: restaurantId, ...body}});
  return {id: rows[0].id, slug: rows[0].slug, name: rows[0].name, position: rows[0].position, active: rows[0].active};
}

export async function commerceSaveProduct(restaurantId: string, raw: CommerceProduct) {
  const product = validateCommerceProduct(raw);
  const category = await supabase<{id: string}[]>(`core_commerce_categories?restaurant_id=eq.${filter(restaurantId)}&id=eq.${filter(product.categoryId)}&select=id`);
  if (!category[0]) throw new CoreError('INVALID_INPUT', 'La categoría no pertenece a este negocio.', 400);
  let id: string;
  try {
    // Product and variants are written in one transaction; variants keep their ids, so carts and stock survive an edit.
    id = await rpc<string>('core_commerce_save_product', {p_restaurant: restaurantId, p_product: {...product, id: isUuid(product.id) ? product.id : null}});
  } catch (error) {
    if (error instanceof DatabaseError && error.detail === 'PRODUCT_NOT_FOUND') throw new CoreError('NOT_FOUND', 'Prenda no encontrada.', 404);
    if (error instanceof DatabaseError && error.code === '23505') throw new CoreError('CONFLICT', 'Ya existe una prenda con ese identificador (slug) o una variante repetida.', 409);
    throw error;
  }
  return (await commerceCatalog(restaurantId)).products.find(row => row.id === id)!;
}

const contentKeys: (keyof CommerceContent)[] = ['heroEyebrow', 'heroTitle', 'heroEmphasis', 'heroDescription', 'studioCopy', 'shippingNote'];

export async function commerceSaveContent(restaurantId: string, content: CommerceContent, settings: CommerceSettings) {
  const validContent = content && typeof content === 'object' && contentKeys.every(key => typeof content[key] === 'string' && content[key].length <= 2_000);
  const validSettings = settings && typeof settings === 'object' && settings.currency === 'ARS' && typeof settings.storeName === 'string' && settings.storeName.trim().length > 0 && settings.storeName.length <= 120
    && typeof settings.pickupEnabled === 'boolean' && typeof settings.deliveryEnabled === 'boolean' && Number.isSafeInteger(settings.deliveryFee) && settings.deliveryFee >= 0 && settings.deliveryFee <= 1_000_000;
  if (!validContent || !validSettings) throw new CoreError('INVALID_INPUT', 'La configuración no es válida.', 400);
  // Persist only the known keys: the column is free-form jsonb and must not become a dumping ground.
  const clean = {content: Object.fromEntries(contentKeys.map(key => [key, content[key].trim()])), settings: {storeName: settings.storeName.trim(), currency: 'ARS', pickupEnabled: settings.pickupEnabled, deliveryEnabled: settings.deliveryEnabled, deliveryFee: settings.deliveryFee}};
  await supabase(`core_commerce_content?restaurant_id=eq.${filter(restaurantId)}`, {method: 'PATCH', body: {...clean, updated_at: new Date().toISOString()}});
  return commerceCatalog(restaurantId);
}

export async function commerceDashboard(restaurantId: string) {
  // Aggregated in SQL: the previous version computed revenue and counts from the latest 500 orders only.
  return rpc<{products: number; activeProducts: number; customers: number; orders: number; revenue: number; recentOrders: CommerceOrder[]}>('core_commerce_dashboard', {p_restaurant: restaurantId});
}
