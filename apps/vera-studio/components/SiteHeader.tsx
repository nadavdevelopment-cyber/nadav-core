'use client';

import Link from 'next/link';
import {useState} from 'react';

type SiteHeaderProps = {
  cartCount?: number;
  onOpenCart?: () => void;
};

export function SiteHeader({cartCount, onOpenCart}: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  return <header className="site-header">
    <button className="menu-button" type="button" onClick={() => setMenuOpen(value => !value)} aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? 'Cerrar navegación' : 'Abrir navegación'}><span/><span/></button>
    <Link className="wordmark" href="/" aria-label="Vera Studio, inicio"><span>VERA</span><i>STUDIO</i></Link>
    <nav id="mobile-navigation" className={menuOpen ? 'open' : ''} aria-label="Principal">
      <Link href="/#coleccion" onClick={closeMenu}>Colección</Link>
      <Link href="/#categorias" onClick={closeMenu}>Categorías</Link>
      <Link href="/#estudio" onClick={closeMenu}>El estudio</Link>
      <Link href="/contacto" onClick={closeMenu}>Contacto</Link>
    </nav>
    {onOpenCart ? <button className="cart-button" type="button" onClick={onOpenCart} aria-label={`Abrir carrito, ${cartCount ?? 0} productos`}><span>Carrito</span><b>{cartCount ?? 0}</b></button> : <Link className="header-collection-link" href="/#coleccion">Ver colección <i>→</i></Link>}
  </header>;
}
