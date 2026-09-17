import type {RestaurantConfig} from './types.ts';

const slugPattern = /^[a-z][a-z0-9-]{2,49}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function defineRestaurantConfig(config: RestaurantConfig): RestaurantConfig {
  if (!slugPattern.test(config.identity.slug)) throw new Error('Invalid restaurant slug.');
  if (!config.identity.name.trim() || config.identity.name.length > 120) throw new Error('Invalid restaurant name.');
  if (config.identity.currency !== 'ARS') throw new Error('NADAV Core currently supports ARS only.');
  if (!Number.isSafeInteger(config.ordering.minimumOrder) || config.ordering.minimumOrder < 0) throw new Error('Invalid minimum order.');
  if (!Number.isSafeInteger(config.ordering.baseDeliveryFee) || config.ordering.baseDeliveryFee < 0) throw new Error('Invalid delivery fee.');
  if (config.ordering.delivery !== config.features.delivery || config.ordering.pickup !== config.features.pickup) throw new Error('Ordering and feature flags disagree.');
  if (config.payments.cash !== config.features.cash || config.payments.transfer !== config.features.transfer || config.payments.mercadoPago !== config.features.mercadoPago) throw new Error('Payments and feature flags disagree.');
  if (config.printing.printNode !== config.features.printNode) throw new Error('Printing and feature flags disagree.');
  for (const value of Object.values(config.hours)) {
    if (typeof value.open !== 'boolean' || !timePattern.test(value.from) || !timePattern.test(value.to)) throw new Error('Invalid opening hours.');
  }
  return Object.freeze(config);
}

export function featureEnabled(config: RestaurantConfig, feature: keyof RestaurantConfig['features']) {
  return config.features[feature];
}
