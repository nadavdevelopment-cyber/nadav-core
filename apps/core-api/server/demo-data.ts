import type {Catalog} from '@nadav/core';

export const demoRestaurantId = '00000000-0000-4000-8000-000000000001';
export const demoCatalog: Catalog = {
  restaurantId: demoRestaurantId,
  revision: 1,
  categories: [{id: 'cat-kitchen', name: 'Cocina', position: 1}, {id: 'cat-drinks', name: 'Bebidas', position: 2}],
  products: [
    {id: 'product-01', categoryId: 'cat-kitchen', name: 'Sándwich de estación', description: 'Pan artesanal, vegetales asados y queso.', price: 9800, promotionalPrice: null, available: true, stock: 30, modifierGroups: [{id: 'bread', name: 'Pan', min: 1, max: 1, options: [{id: 'country', name: 'De campo', price: 0, available: true}, {id: 'focaccia', name: 'Focaccia', price: 900, available: true}]}]},
    {id: 'product-02', categoryId: 'cat-kitchen', name: 'Pasta del día', description: 'Pasta fresca con salsa de estación.', price: 12400, promotionalPrice: 11200, available: true, stock: 20, modifierGroups: []},
    {id: 'product-03', categoryId: 'cat-drinks', name: 'Limonada', description: 'Limón, menta y jengibre.', price: 3900, promotionalPrice: null, available: true, stock: null, modifierGroups: []}
  ],
  promotions: [{id: 'promo-welcome', name: 'Bienvenida', code: 'CORE10', type: 'percentage', value: 10, productIds: [], active: true}],
  deliveryZones: [{id: 'zone-center', name: 'Centro', fee: 1800, active: true}, {id: 'zone-north', name: 'Zona norte', fee: 2500, active: true}]
};
