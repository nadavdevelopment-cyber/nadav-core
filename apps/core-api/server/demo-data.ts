import type {Catalog} from '@nadav/core';

export const demoRestaurantId = '00000000-0000-4000-8000-000000000001';

export const demoCatalog: Catalog = {
  restaurantId: demoRestaurantId,
  revision: 2,

  categories: [
    {id: 'cat-burgers', name: 'Burgers', position: 1},
    {id: 'cat-drinks', name: 'Bebidas', position: 2}
  ],

  products: [
    {
      id: 'burger-sandwich',
      categoryId: 'cat-burgers',
      name: 'Sándwich de carne con queso y cebolla caramelizada',
      description: 'Carne, queso fundido y cebolla caramelizada.',
      price: 11000,
      promotionalPrice: null,
      image: '/images/burger-sandwich.webp',
      available: true,
      stock: 30,
      modifierGroups: []
    },
    {
      id: 'doble-smash',
      categoryId: 'cat-burgers',
      name: 'Doble hamburguesa smash con cheddar fundido',
      description: 'Doble carne smash con cheddar bien fundido.',
      price: 13000,
      promotionalPrice: null,
      image: '/images/doble-smash.webp',
      available: true,
      stock: 30,
      modifierGroups: []
    },
    {
      id: 'bacon-cheddar',
      categoryId: 'cat-burgers',
      name: 'Hamburguesa de tocino y cheddar',
      description: 'Carne smash, tocino crocante y cheddar.',
      price: 12000,
      promotionalPrice: null,
      image: '/images/bacon-cheddar.webp',
      available: true,
      stock: 30,
      modifierGroups: []
    },
    {
      id: 'morgade',
      categoryId: 'cat-drinks',
      name: 'Morgade',
      description: 'Bien fría.',
      price: 2500,
      promotionalPrice: null,
      image: '/images/morgade.webp',
      available: true,
      stock: null,
      modifierGroups: []
    },
    {
      id: 'sprite',
      categoryId: 'cat-drinks',
      name: 'Sprite',
      description: 'Bien fría.',
      price: 3000,
      promotionalPrice: null,
      image: '/images/sprite.webp',
      available: true,
      stock: null,
      modifierGroups: []
    },
    {
      id: 'andes-ipa',
      categoryId: 'cat-drinks',
      name: 'Andes IPA',
      description: 'IPA fría.',
      price: 4000,
      promotionalPrice: null,
      image: '/images/andes-ipa.webp',
      available: true,
      stock: null,
      modifierGroups: []
    }
  ],

  promotions: [],

  deliveryZones: [
    {id: 'zone-center', name: 'Centro', fee: 1800, active: true},
    {id: 'zone-north', name: 'Zona norte', fee: 2500, active: true}
  ]
};
