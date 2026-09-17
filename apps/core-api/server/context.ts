import demoConfig from '../../../restaurant.config';

import {
  MemoryCoreRepository,
  SupabaseCoreRepository
} from '@nadav/adapters';

import {demoCatalog, demoRestaurantId} from './demo-data';

const demo = process.env.NADAV_CORE_DEMO_MODE === 'true';

const repository = demo
  ? new MemoryCoreRepository(demoConfig, demoCatalog)
  : new SupabaseCoreRepository();

export async function coreContext() {
  const restaurantId =
    process.env.NADAV_CORE_RESTAURANT_ID ||
    (demo ? demoRestaurantId : '');

  if (!/^[0-9a-f-]{36}$/i.test(restaurantId)) {
    throw new Error('NADAV_CORE_RESTAURANT_ID is invalid.');
  }

  const config = demo
    ? demoConfig
    : await repository.restaurantConfig(restaurantId);

  if (!config) {
    throw new Error('RESTAURANT_NOT_FOUND');
  }

  return {
    restaurantId,
    config,
    repository,
    demo
  };
}

export async function assertRestaurant(slug: string) {
  const context = await coreContext();

  if (slug !== context.config.identity.slug) {
    throw new Error('RESTAURANT_NOT_FOUND');
  }

  return context;
}
