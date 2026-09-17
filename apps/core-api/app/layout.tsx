import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import './styles.css';

export const metadata: Metadata = {title: 'NADAV Core Admin', description: 'Infraestructura gastronómica reutilizable'};
export default function Layout({children}: {children: ReactNode}) { return <html lang="es"><body>{children}</body></html>; }
