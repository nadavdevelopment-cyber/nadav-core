import {invalid, unavailable} from './errors.ts';
import type {Catalog, CheckoutInput, PricedItem, Product, Promotion, Quote, RestaurantConfig} from './types.ts';

function safeText(value: unknown, max: number, label: string) {
  if (typeof value !== 'string' || value.length > max) throw invalid(`${label} inválido.`);
  return value.trim();
}

function priceItem(product: Product, input: CheckoutInput['items'][number], stockEnabled: boolean): PricedItem {
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100) throw invalid('Cantidad inválida.');
  if (!product.available) throw unavailable(`${product.name} no está disponible.`);
  if (stockEnabled && product.stock !== null && product.stock < input.quantity) throw unavailable(`Quedan ${product.stock} unidades de ${product.name}.`);
  if (!Array.isArray(input.selections) || input.selections.length > 50) throw invalid('Opciones inválidas.');
  const seen = new Set<string>();
  const modifiers = input.selections.map(selection => {
    const group = product.modifierGroups.find(row => row.id === selection.groupId);
    const option = group?.options.find(row => row.id === selection.optionId && row.available);
    if (!group || !option || seen.has(`${group.id}:${option.id}`)) throw invalid('Una opción ya no está disponible.');
    seen.add(`${group.id}:${option.id}`);
    return {groupId: group.id, groupName: group.name, optionId: option.id, name: option.name, price: option.price};
  });
  for (const group of product.modifierGroups) {
    const count = modifiers.filter(modifier => modifier.groupId === group.id).length;
    if (count < group.min || count > group.max) throw invalid(`Revisá las opciones de ${group.name}.`);
  }
  const unitPrice = (product.promotionalPrice ?? product.price) + modifiers.reduce((sum, modifier) => sum + modifier.price, 0);
  return {productId: product.id, name: product.name, unitPrice, quantity: input.quantity, modifiers, notes: safeText(input.notes ?? '', 500, 'Nota'), lineTotal: unitPrice * input.quantity};
}

function promotionDiscount(items: PricedItem[], promotion: Promotion | undefined) {
  if (!promotion) return 0;
  const eligible = items.filter(item => promotion.productIds.length === 0 || promotion.productIds.includes(item.productId));
  const amount = eligible.reduce((sum, item) => sum + item.lineTotal, 0);
  return promotion.type === 'percentage' ? Math.round(amount * Math.min(100, promotion.value) / 100) : Math.min(amount, promotion.value);
}

export function quoteCheckout(config: RestaurantConfig, catalog: Catalog, input: CheckoutInput, now = new Date()): Quote {
  if (!input || !Array.isArray(input.items) || input.items.length === 0 || input.items.length > 100) throw invalid('El carrito está vacío o es demasiado grande.');
  safeText(input.customer?.name, 120, 'Nombre');
  const phone = safeText(input.customer?.phone, 40, 'Teléfono').replace(/\D/g, '');
  if (phone.length < 8) throw invalid('Ingresá un teléfono válido.');
  safeText(input.customer?.email ?? '', 254, 'Email');
  safeText(input.notes ?? '', 1500, 'Nota');
  const paymentFeature = input.paymentMethod === 'mercado_pago' ? 'mercadoPago' : input.paymentMethod;
  if (!config.features[paymentFeature]) throw unavailable('Ese medio de pago no está disponible.');
  if (input.mode === 'pickup' && !config.features.pickup) throw unavailable('El retiro no está disponible.');
  if (input.mode === 'delivery' && !config.features.delivery) throw unavailable('El delivery no está disponible.');
  if (input.mode === 'delivery' && !safeText(input.address ?? '', 500, 'Dirección')) throw invalid('Ingresá la dirección de entrega.');
  const products = new Map(catalog.products.map(product => [product.id, product]));
  const items = input.items.map(item => {
    const product = products.get(item.productId);
    if (!product) throw notAvailableProduct();
    return priceItem(product, item, config.features.stock);
  });
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  if (subtotal < config.ordering.minimumOrder) throw unavailable(`El pedido mínimo es $${config.ordering.minimumOrder}.`);
  let promotion: Promotion | undefined;
  const code = (input.promotionCode ?? '').trim().toUpperCase();
  if (code) {
    if (!config.features.promotions) throw unavailable('Las promociones no están habilitadas.');
    promotion = catalog.promotions.find(row => row.active && row.code?.trim().toUpperCase() === code && (!row.startsAt || new Date(row.startsAt) <= now) && (!row.endsAt || new Date(row.endsAt) >= now));
    if (!promotion) throw invalid('El código no es válido o ya venció.');
  }
  const zone = input.mode === 'delivery' && input.deliveryZoneId ? catalog.deliveryZones.find(row => row.id === input.deliveryZoneId && row.active) : undefined;
  if (input.mode === 'delivery' && catalog.deliveryZones.some(row => row.active) && !zone) throw invalid('Seleccioná una zona de envío válida.');
  const deliveryFee = input.mode === 'delivery' ? zone?.fee ?? config.ordering.baseDeliveryFee : 0;
  const discount = promotionDiscount(items, promotion);
  return {items, subtotal, discount, deliveryFee, total: subtotal - discount + deliveryFee, currency: 'ARS'};
}

function notAvailableProduct() {
  return unavailable('Un producto ya no está disponible.');
}
