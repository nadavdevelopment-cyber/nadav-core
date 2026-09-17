import type {CartSelection, Product} from '@nadav/core';

export type CartLine = {
  key: string;
  product: Product;
  quantity: number;
  selections: CartSelection[];
  notes: string;
};

export type Presentation = {
  name: string;
  slogan: string;
  accent: string;
  background: string;
  address: string;
  hours: string;
  instagram: string;
  whatsapp: string;
};

export type StorefrontConfig = {coreUrl: string; slug: string; presentation: Presentation};

export function unitPrice(line: Pick<CartLine, 'product' | 'selections'>) {
  const extras = line.selections.reduce((sum, selection) => {
    const group = line.product.modifierGroups.find(candidate => candidate.id === selection.groupId);
    const option = group?.options.find(candidate => candidate.id === selection.optionId);
    return sum + (option?.price ?? 0);
  }, 0);
  return (line.product.promotionalPrice ?? line.product.price) + extras;
}

export function lineLabel(line: CartLine) {
  return line.selections.flatMap(selection => {
    const group = line.product.modifierGroups.find(candidate => candidate.id === selection.groupId);
    const option = group?.options.find(candidate => candidate.id === selection.optionId);
    return option ? [option.name] : [];
  }).join(' · ');
}
