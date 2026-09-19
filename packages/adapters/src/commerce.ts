import {createCommerceOrder, quoteCommerceCheckout, transitionCommerceOrder, type CommerceCatalog, type CommerceCategory, type CommerceCheckoutInput, type CommerceContent, type CommerceOrder, type CommerceOrderStatus, type CommerceProduct, type CommerceRole, type CommerceSettings, type CommerceVariant, validateCommerceProduct} from '@nadav/core';
import {CoreError} from '@nadav/core';
import {rpc, supabase} from './supabase.ts';

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
  const [categories, products, variants, contentRows] = await Promise.all([
    supabase<CategoryRow[]>(`core_commerce_categories?restaurant_id=eq.${filter(restaurantId)}&select=${select}&order=position.asc,name.asc`),
    supabase<ProductRow[]>(`core_commerce_products?restaurant_id=eq.${filter(restaurantId)}&select=id,slug,category_id,name,description,price,images,composition,care,active&order=created_at.asc`),
    supabase<VariantRow[]>(`core_commerce_variants?restaurant_id=eq.${filter(restaurantId)}&select=id,product_id,sku,color,color_value,size,stock,active&order=created_at.asc`),
    supabase<ContentRow[]>(`core_commerce_content?restaurant_id=eq.${filter(restaurantId)}&select=content,settings`)
  ]);
  const content = contentRows[0];
  if (!content) throw new CoreError('NOT_FOUND', 'Commerce no está configurado.', 404);
  const variantsByProduct = new Map<string, CommerceVariant[]>();
  for (const variant of variants) variantsByProduct.set(variant.product_id, [...(variantsByProduct.get(variant.product_id) ?? []), {id: variant.id, sku: variant.sku, color: variant.color, colorValue: variant.color_value, size: variant.size, stock: variant.stock, active: variant.active}]);
  return {restaurantId, categories: categories.map(row => ({id: row.id, slug: row.slug, name: row.name, position: row.position, active: row.active})), products: products.map(row => ({id: row.id, slug: row.slug, categoryId: row.category_id, name: row.name, description: row.description, price: Number(row.price), images: row.images ?? [], composition: row.composition, care: row.care, active: row.active, variants: variantsByProduct.get(row.id) ?? []})), content: content.content, settings: content.settings};
}

export async function commerceQuote(restaurantId: string, input: CommerceCheckoutInput) { return quoteCommerceCheckout(await commerceCatalog(restaurantId), input); }

export async function commercePlaceOrder(restaurantId: string, key: string, input: CommerceCheckoutInput) {
  const quote = await commerceQuote(restaurantId, input);
  const provisional = createCommerceOrder(restaurantId, 0, key, input, quote);
  return rpc<{order: CommerceOrder; created: boolean}>('core_commerce_place_order', {p_restaurant: restaurantId, p_key: key, p_input: {items: input.items, customer: input.customer, fulfillment: input.fulfillment, address: input.address, city: input.city, paymentMethod: input.paymentMethod, requestId: provisional.id}});
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
  const order = await commerceOrder(restaurantId, orderId);
  if (!order) throw new CoreError('NOT_FOUND', 'Pedido no encontrado.', 404);
  const updated = transitionCommerceOrder(order, status);
  const rows = await supabase<{data: CommerceOrder}[]>(`core_commerce_orders?restaurant_id=eq.${filter(restaurantId)}&id=eq.${filter(orderId)}`, {method: 'PATCH', body: {status, data: updated, updated_at: new Date().toISOString()}});
  if (!rows[0]) throw new CoreError('CONFLICT', 'El pedido cambió en otra sesión.', 409);
  return rows[0].data;
}

export async function commerceSaveCategory(restaurantId: string, category: Omit<CommerceCategory, 'id'> & {id?: string}) {
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(category.slug) || !category.name.trim() || !Number.isInteger(category.position)) throw new CoreError('INVALID_INPUT', 'La categoría no es válida.', 400);
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
  const body = {category_id: product.categoryId, slug: product.slug, name: product.name, description: product.description, price: product.price, images: product.images, composition: product.composition, care: product.care, active: product.active, updated_at: new Date().toISOString()};
  let id = product.id;
  if (/^[0-9a-f-]{36}$/i.test(product.id)) {
    const rows = await supabase<ProductRow[]>(`core_commerce_products?restaurant_id=eq.${filter(restaurantId)}&id=eq.${filter(product.id)}`, {method: 'PATCH', body});
    if (!rows[0]) throw new CoreError('NOT_FOUND', 'Prenda no encontrada.', 404);
  } else {
    const rows = await supabase<ProductRow[]>('core_commerce_products', {method: 'POST', body: {restaurant_id: restaurantId, ...body}});
    id = rows[0].id;
  }
  await supabase(`core_commerce_variants?restaurant_id=eq.${filter(restaurantId)}&product_id=eq.${filter(id)}`, {method: 'DELETE', prefer: 'return=minimal'});
  await supabase('core_commerce_variants', {method: 'POST', body: product.variants.map(variant => ({restaurant_id: restaurantId, product_id: id, sku: variant.sku, color: variant.color, color_value: variant.colorValue, size: variant.size, stock: variant.stock, active: variant.active}))});
  return (await commerceCatalog(restaurantId)).products.find(row => row.id === id)!;
}

export async function commerceSaveContent(restaurantId: string, content: CommerceContent, settings: CommerceSettings) {
  if (!content || !settings || settings.currency !== 'ARS' || !Number.isSafeInteger(settings.deliveryFee) || settings.deliveryFee < 0 || settings.deliveryFee > 1_000_000) throw new CoreError('INVALID_INPUT', 'La configuración no es válida.', 400);
  await supabase(`core_commerce_content?restaurant_id=eq.${filter(restaurantId)}`, {method: 'PATCH', body: {content, settings, updated_at: new Date().toISOString()}});
  return commerceCatalog(restaurantId);
}

export async function commerceDashboard(restaurantId: string) {
  const [catalog, orders, customers] = await Promise.all([commerceCatalog(restaurantId), commerceListOrders(restaurantId), supabase<{id: string}[]>(`core_commerce_customers?restaurant_id=eq.${filter(restaurantId)}&select=id`)]);
  return {products: catalog.products.length, activeProducts: catalog.products.filter(product => product.active).length, customers: customers.length, orders: orders.length, revenue: orders.filter(order => order.status !== 'cancelled').reduce((sum, order) => sum + order.total, 0), recentOrders: orders.slice(0, 5)};
}
