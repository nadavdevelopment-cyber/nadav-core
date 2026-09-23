import type {Metadata, Viewport} from 'next';
import type {ReactNode} from 'react';
import './styles.css';
import './admin-redesign.css';

export const metadata: Metadata = {
  title: {default: 'Vera Studio — Indumentaria femenina', template: '%s · Vera Studio'},
  description: 'Prendas simples, femeninas y pensadas para usar una y otra vez. Colecciones chicas, elegidas con intención.',
  applicationName: 'Vera Studio',
  openGraph: {
    title: 'Vera Studio — Nueva colección',
    description: 'Prendas simples, femeninas y pensadas para usar una y otra vez.',
    type: 'website',
    locale: 'es_AR',
    siteName: 'Vera Studio'
  },
  robots: {index: true, follow: true}
};

export const viewport: Viewport = {themeColor: '#e8ddce', colorScheme: 'light'};

export default function Layout({children}: {children: ReactNode}) {
  return <html lang="es-AR"><body>{children}</body></html>;
}
