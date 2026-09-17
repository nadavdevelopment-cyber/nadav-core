import {defineRestaurantConfig, type Catalog, type CheckoutInput} from '../packages/core/src/index.ts';

export const restaurantId = '11111111-1111-4111-8111-111111111111';
export const config = defineRestaurantConfig({
  identity: {slug: 'test-kitchen', name: 'Test Kitchen', locale: 'es-AR', currency: 'ARS', timeZone: 'America/Argentina/Buenos_Aires'},
  ordering: {pickup: true, delivery: true, minimumOrder: 1000, baseDeliveryFee: 500},
  payments: {cash: true, transfer: true, mercadoPago: true},
  printing: {printNode: true, paper: '80'},
  features: {delivery: true, pickup: true, mercadoPago: true, cash: true, transfer: true, stock: true, promotions: true, customers: true, analytics: true, printNode: true},
  hours: Object.fromEntries(['sun','mon','tue','wed','thu','fri','sat'].map(day => [day, {open: true, from: '00:00', to: '23:59'}]))
});
export const catalog: Catalog = {
  restaurantId,
  revision: 1,
  categories: [{id: 'food', name: 'Comida', position: 1}],
  products: [{id: 'burger', categoryId: 'food', name: 'Burger', description: '', price: 1000, promotionalPrice: null, image: '', available: true, stock: 3, modifierGroups: [{id: 'size', name: 'Tamaño', min: 1, max: 1, options: [{id: 'large', name: 'Grande', price: 300, available: true}, {id: 'small', name: 'Simple', price: 0, available: true}]}]}, {id: 'fries', categoryId: 'food', name: 'Papas', description: '', price: 700, promotionalPrice: 600, image: '', available: true, stock: 10, modifierGroups: []}],
  promotions: [{id: 'ten', name: 'Diez', code: 'TEN', type: 'percentage', value: 10, productIds: [], active: true}],
  deliveryZones: [{id: 'near', name: 'Cerca', fee: 800, active: true}]
};
export const checkout: CheckoutInput = {items: [{productId: 'burger', quantity: 1, selections: [{groupId: 'size', optionId: 'large'}]}], customer: {name: 'Ada', phone: '221 555 0000', email: 'ada@example.com'}, mode: 'pickup', paymentMethod: 'cash'};
