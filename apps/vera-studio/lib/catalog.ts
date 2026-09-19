import type {CommerceCatalog, CommerceProduct, CommerceVariant} from '@nadav/core';

export type Size = string;
export type Product = CommerceProduct & {category: string; image: string; colors: {name: string; value: string}[]; sizes: string[]};
export type Category = string;
export const money = (value: number) => new Intl.NumberFormat('es-AR', {style: 'currency', currency: 'ARS', maximumFractionDigits: 0}).format(value);

function unique<T>(values: T[]) { return [...new Set(values)]; }
export function productForStorefront(product: CommerceProduct, catalog: CommerceCatalog): Product {
  const category = catalog.categories.find(row => row.id === product.categoryId)?.name ?? 'Colección';
  const colors = unique(product.variants.map(variant => variant.color)).map(name => ({name, value: product.variants.find(variant => variant.color === name)?.colorValue ?? '#d2c1b0'}));
  return {...product, category, image: product.images[0] ?? '/images/vera-hero.webp', colors, sizes: unique(product.variants.map(variant => variant.size))};
}
export function variantFor(product: Product, color: string, size: string): CommerceVariant | null { return product.variants.find(variant => variant.color === color && variant.size === size && variant.active) ?? null; }
