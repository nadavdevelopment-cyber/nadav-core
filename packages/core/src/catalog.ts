import {invalid} from './errors.ts';
import type {Catalog} from './types.ts';

const text = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const money = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 1_000_000_000;
export function validateCatalog(catalog: Catalog, restaurantId: string) {
  if (!catalog || catalog.restaurantId !== restaurantId || !Number.isSafeInteger(catalog.revision) || catalog.revision < 1) throw invalid('Catálogo inválido.');
  if (!Array.isArray(catalog.categories) || !Array.isArray(catalog.products) || !Array.isArray(catalog.promotions) || !Array.isArray(catalog.deliveryZones)) throw invalid('Catálogo inválido.');
  const unique = (rows: {id: string}[]) => rows.length === new Set(rows.map(row => row.id)).size && rows.every(row => text(row.id, 90));
  if (!unique(catalog.categories) || !unique(catalog.products) || !unique(catalog.promotions) || !unique(catalog.deliveryZones)) throw invalid('Hay identificadores duplicados o inválidos.');
  const categories = new Set(catalog.categories.map(row => row.id));
  if (catalog.categories.length > 200 || catalog.categories.some(row => !text(row.name, 100) || !Number.isSafeInteger(row.position))) throw invalid('Categorías inválidas.');
  if (catalog.products.length > 2000 || catalog.products.some(product => !categories.has(product.categoryId) || !text(product.name, 160) || !money(product.price) || product.price === 0 || product.promotionalPrice !== null && product.promotionalPrice !== undefined && (!money(product.promotionalPrice) || product.promotionalPrice >= product.price) || product.stock !== null && (!Number.isSafeInteger(product.stock) || product.stock < 0) || !Array.isArray(product.modifierGroups) || product.modifierGroups.length > 20 || product.modifierGroups.some(group => !text(group.id, 90) || !text(group.name, 100) || !Number.isInteger(group.min) || !Number.isInteger(group.max) || group.min < 0 || group.max < group.min || group.options.length > 40 || group.max > group.options.length || !unique(group.options) || group.options.some(option => !text(option.name, 100) || !money(option.price))))) throw invalid('Productos u opciones inválidos.');
  const products = new Set(catalog.products.map(row => row.id));
  if (catalog.promotions.length > 200 || catalog.promotions.some(promotion => !text(promotion.name, 150) || promotion.code !== undefined && promotion.code.length > 60 || !['percentage', 'fixed'].includes(promotion.type) || !money(promotion.value) || promotion.type === 'percentage' && promotion.value > 100 || promotion.productIds.some(id => !products.has(id)))) throw invalid('Promociones inválidas.');
  if (catalog.deliveryZones.length > 100 || catalog.deliveryZones.some(zone => !text(zone.name, 120) || !money(zone.fee))) throw invalid('Zonas de delivery inválidas.');
  return structuredClone(catalog);
}
