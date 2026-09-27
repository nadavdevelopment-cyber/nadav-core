export const restaurant = {
  coreUrl: process.env.NEXT_PUBLIC_NADAV_CORE_URL ?? 'http://localhost:3000',
  slug: 'burgerhouse',
  presentation: {
    name: 'BurgerHouse',
    slogan: 'SMASH. CHEESE. REPEAT.',
    accent: '#9f1f20',
    background: '#f2e4c8',
    address: 'Punto de retiro a confirmar',
    hours: 'Consultá disponibilidad al pedir',
    instagram: '',
    whatsapp: ''
  }
} as const;
