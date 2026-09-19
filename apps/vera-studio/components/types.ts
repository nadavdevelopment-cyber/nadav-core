import type {Product, Size} from '../lib/catalog';

export type CartLine = {
  key: string;
  product: Product;
  size: Size;
  color: string;
  quantity: number;
};

export type CheckoutData = {
  name: string;
  email: string;
  phone: string;
  fulfillment: 'delivery' | 'pickup';
  address: string;
  city: string;
  payment: 'transfer' | 'card';
};
