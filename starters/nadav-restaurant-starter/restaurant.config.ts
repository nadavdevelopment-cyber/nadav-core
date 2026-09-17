export const restaurant = {
  coreUrl: process.env.NEXT_PUBLIC_NADAV_CORE_URL ?? 'http://localhost:3000',
  slug: process.env.NEXT_PUBLIC_NADAV_RESTAURANT_SLUG ?? 'new-restaurant',
  presentation: {
    name: 'Nuevo restaurante',
    accent: '#1f2821',
    background: '#f5f4ef'
  }
} as const;
