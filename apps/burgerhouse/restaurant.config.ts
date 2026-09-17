export const restaurant = {
  coreUrl: process.env.NEXT_PUBLIC_NADAV_CORE_URL ?? 'http://localhost:3000',
  slug: process.env.NEXT_PUBLIC_NADAV_RESTAURANT_SLUG ?? 'burgerhouse',
  presentation: {
    name: 'BurgerHouse',
    slogan: 'SMASH. CHEESE. REPEAT.',
    accent: '#9f1f20',
    background: '#f2e4c8',
    address: 'Tu dirección · La Plata',
    hours: 'Mar–Dom · 12:00 a 00:00',
    instagram: 'https://instagram.com/',
    whatsapp: 'https://wa.me/'
  }
} as const;
