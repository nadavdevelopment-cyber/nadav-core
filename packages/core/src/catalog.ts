import {invalid} from './errors.ts';
import type {Catalog, ModifierGroup, Product, Promotion} from './types.ts';

const text = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const money = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 1_000_000_000;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const safeImage = (value: unknown) => value === undefined || value === null || value === '' || (typeof value === 'string' && value.length <= 2_000 && /^(\/(?!\/)|https:\/\/)/.test(value));
const uniqueIds = (rows: unknown[]) => rows.every(row => isRecord(row) && text(row.id, 90)) && rows.length === new Set(rows.map(row => (row as {id: string}).id)).size;

function validModifierGroup(group: ModifierGroup) {
  return isRecord(group) && text(group.id, 90) && text(group.name, 100)
    && Number.isInteger(group.min) && Number.isInteger(group.max) && group.min >= 0 && group.max >= group.min
    && Array.isArray(group.options) && group.options.length <= 40 && group.max <= group.options.length && uniqueIds(group.options)
    && group.options.every(option => text(option.name, 100) && money(option.price) && typeof option.available === 'boolean');
}

function validProduct(product: Product, categories: Set<string>) {
  return isRecord(product) && categories.has(product.categoryId) && text(product.name, 160)
    && typeof product.description === 'string' && product.description.length <= 2_000
    && money(product.price) && product.price > 0
    && (product.promotionalPrice === null || product.promotionalPrice === undefined || (money(product.promotionalPrice) && product.promotionalPrice < product.price))
    && typeof product.available === 'boolean' && safeImage(product.image)
    && (product.stock === null || (Number.isSafeInteger(product.stock) && product.stock >= 0))
    && Array.isArray(product.modifierGroups) && product.modifierGroups.length <= 20
    && uniqueIds(product.modifierGroups) && product.modifierGroups.every(validModifierGroup);
}

function validPromotion(promotion: Promotion, products: Set<string>) {
  if (!isRecord(promotion)) return false;
  if (promotion.startsAt !== undefined && promotion.startsAt !== null && typeof promotion.startsAt !== 'string') return false;
  if (promotion.endsAt !== undefined && promotion.endsAt !== null && typeof promotion.endsAt !== 'string') return false;
  const starts = promotion.startsAt ? Date.parse(promotion.startsAt) : null;
  const ends = promotion.endsAt ? Date.parse(promotion.endsAt) : null;
  return text(promotion.name, 150)
    && (promotion.code === undefined || (typeof promotion.code === 'string' && promotion.code.length <= 60))
    && ['percentage', 'fixed'].includes(promotion.type) && money(promotion.value) && (promotion.type !== 'percentage' || promotion.value <= 100)
    && typeof promotion.active === 'boolean'
    && Array.isArray(promotion.productIds) && promotion.productIds.every(id => products.has(id))
    && (starts === null || !Number.isNaN(starts)) && (ends === null || !Number.isNaN(ends)) && (starts === null || ends === null || starts <= ends);
}

export function validateCatalog(catalog: Catalog, restaurantId: string) {
  if (!isRecord(catalog) || catalog.restaurantId !== restaurantId || !Number.isSafeInteger(catalog.revision) || catalog.revision < 1) throw invalid('Catálogo inválido.');
  if (!Array.isArray(catalog.categories) || !Array.isArray(catalog.products) || !Array.isArray(catalog.promotions) || !Array.isArray(catalog.deliveryZones)) throw invalid('Catálogo inválido.');
  if (![catalog.categories, catalog.products, catalog.promotions, catalog.deliveryZones].every(uniqueIds)) throw invalid('Hay identificadores duplicados o inválidos.');
  const categories = new Set(catalog.categories.map(row => row.id));
  if (catalog.categories.length > 200 || catalog.categories.some(row => !text(row.name, 100) || !Number.isSafeInteger(row.position))) throw invalid('Categorías inválidas.');
  if (catalog.products.length > 2_000 || !catalog.products.every(product => validProduct(product, categories))) throw invalid('Productos u opciones inválidos.');
  const products = new Set(catalog.products.map(row => row.id));
  if (catalog.promotions.length > 200 || !catalog.promotions.every(promotion => validPromotion(promotion, products))) throw invalid('Promociones inválidas.');
  const codes = catalog.promotions.map(promotion => promotion.code?.trim().toUpperCase()).filter(Boolean);
  if (codes.length !== new Set(codes).size) throw invalid('Hay códigos de promoción repetidos.');
  if (catalog.deliveryZones.length > 100 || catalog.deliveryZones.some(zone => !text(zone.name, 120) || !money(zone.fee) || typeof zone.active !== 'boolean')) throw invalid('Zonas de delivery inválidas.');
  return structuredClone(catalog);
}
