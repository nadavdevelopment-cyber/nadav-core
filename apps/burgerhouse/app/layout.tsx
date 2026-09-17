import type {Metadata, Viewport} from 'next';
import type {ReactNode} from 'react';
import './styles.css';

export const metadata: Metadata = {
  title: {default: 'BurgerHouse — Smash, cheese, repeat', template: '%s · BurgerHouse'},
  description: 'Smash burgers hechas al momento, con queso de verdad y cero vueltas. Pedí online para retirar o recibir en tu casa.',
  applicationName: 'BurgerHouse',
  openGraph: {
    title: 'BurgerHouse — Smash, cheese, repeat',
    description: 'Smash burgers hechas al momento. Pedí, comé, repetí.',
    type: 'website',
    locale: 'es_AR',
    siteName: 'BurgerHouse'
  },
  robots: {index: true, follow: true}
};

export const viewport: Viewport = {themeColor: '#9f1f20', colorScheme: 'light'};

export default function Layout({children}: {children: ReactNode}) {
  return <html lang="es-AR"><body>{children}</body></html>;
}
