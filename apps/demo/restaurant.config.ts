export const storefrontConfig = {
  coreUrl: process.env.NEXT_PUBLIC_NADAV_CORE_URL ?? 'http://localhost:3000',
  restaurant: process.env.NEXT_PUBLIC_NADAV_RESTAURANT_SLUG ?? 'demo-restaurant',
  presentation: {accent: '#c95f3d', background: '#f4efe5', heading: 'Cocina simple. Infraestructura seria.'}
} as const;
