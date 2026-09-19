import type {CommerceOrder} from '@nadav/core';
import type {Product, Size} from '../lib/catalog';

export type CartLine = {
  key: string;
  product: Product;
  variantId: string;
  size: Size;
  color: string;
  quantity: number;
};

export type ConfirmedOrder = {order: CommerceOrder; lines: CartLine[]; customer: CheckoutData};

export type CheckoutData = {
  name: string;
  email: string;
  phone: string;
  fulfillment: 'delivery' | 'pickup';
  address: string;
  city: string;
  payment: 'transfer' | 'card';
};
