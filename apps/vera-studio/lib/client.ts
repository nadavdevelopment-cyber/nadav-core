import {createNadavClient} from '@nadav/sdk';

export function veraClient() {
  const baseUrl = process.env.NEXT_PUBLIC_NADAV_CORE_URL;
  const restaurant = process.env.NEXT_PUBLIC_NADAV_RESTAURANT_SLUG ?? 'vera-studio';
  if (!baseUrl) throw new Error('La tienda no está configurada.');
  return createNadavClient({baseUrl, restaurant});
}
