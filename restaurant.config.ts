import {defineRestaurantConfig} from '@nadav/core';

export default defineRestaurantConfig({
  identity: {
    slug: 'demo-restaurant',
    name: 'NADAV Core Demo Restaurant',
    tagline: 'Una cocina independiente sobre NADAV Core',
    locale: 'es-AR',
    currency: 'ARS',
    timeZone: 'America/Argentina/Buenos_Aires'
  },
  ordering: {
    pickup: true,
    delivery: true,
    minimumOrder: 5000,
    baseDeliveryFee: 1800
  },
  payments: {
    cash: true,
    transfer: true,
    mercadoPago: true
  },
  printing: {
    printNode: true,
    paper: '80'
  },
  features: {
    delivery: true,
    pickup: true,
    mercadoPago: true,
    cash: true,
    transfer: true,
    stock: true,
    promotions: true,
    customers: true,
    analytics: true,
    printNode: true
  },
  hours: {
    mon: {open: true, from: '11:00', to: '23:00'},
    tue: {open: true, from: '11:00', to: '23:00'},
    wed: {open: true, from: '11:00', to: '23:00'},
    thu: {open: true, from: '11:00', to: '23:00'},
    fri: {open: true, from: '11:00', to: '00:30'},
    sat: {open: true, from: '11:00', to: '00:30'},
    sun: {open: true, from: '11:00', to: '23:00'}
  }
});
