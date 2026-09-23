import demoConfig from '../../../restaurant.config';

import {
  MemoryCoreRepository,
  SupabaseCoreRepository
} from '@nadav/adapters';
import {isUuid, notFound, type RestaurantConfig} from '@nadav/core';

import {demoCatalog, demoRestaurantId} from './demo-data';

const demo = process.env.NADAV_CORE_DEMO_MODE === 'true';

const repository = demo
  ? new MemoryCoreRepository(demoConfig, demoCatalog)
  : new SupabaseCoreRepository();

// The restaurant configuration changes rarely; avoid one database round trip per API call.
const configTtlMs = 30_000;
let cachedConfig: {restaurantId: string; config: RestaurantConfig; expires: number} | null = null;

export async function coreContext() {
  // The in-memory repository forgets every order on restart and is not shared between serverless instances.
  if (demo && process.env.VERCEL_ENV === 'production') {
    throw new Error('NADAV_CORE_DEMO_MODE must be false in production deployments.');
  }

  const restaurantId =
    process.env.NADAV_CORE_RESTAURANT_ID ||
    (demo ? demoRestaurantId : '');

  if (!isUuid(restaurantId)) {
    throw new Error('NADAV_CORE_RESTAURANT_ID is invalid.');
  }

  let config: RestaurantConfig | null;

  if (demo) {
    config = demoConfig;
  } else if (cachedConfig && cachedConfig.restaurantId === restaurantId && cachedConfig.expires > Date.now()) {
    config = cachedConfig.config;
  } else {
    config = await repository.restaurantConfig(restaurantId);
    if (config) cachedConfig = {restaurantId, config, expires: Date.now() + configTtlMs};
  }

  if (!config) {
    throw notFound('Restaurante no encontrado.');
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
    throw notFound('Restaurante no encontrado.');
  }

  return context;
}
