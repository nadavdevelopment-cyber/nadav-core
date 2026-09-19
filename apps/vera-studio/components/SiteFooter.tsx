import Link from 'next/link';

export function SiteFooter() {
  return <footer id="contacto"><div><Link className="wordmark" href="/"><span>VERA</span><i>STUDIO</i></Link><p>Prendas elegidas con intención.<br/>Pedidos preparados desde nuestro estudio.</p></div><div><h3>Ayuda</h3><Link href="/contacto">Contacto</Link><Link href="/cambios-y-devoluciones">Cambios y devoluciones</Link><Link href="/envios">Envíos</Link><Link href="/guia-de-talles">Guía de talles</Link></div><div><h3>Vera</h3><Link href="/#coleccion">Colección</Link><Link href="/#categorias">Categorías</Link><Link href="/#estudio">El estudio</Link></div><div className="newsletter"><h3>Quedate cerca</h3><p>Para consultas, talles o novedades, escribinos desde nuestro formulario de contacto.</p><Link className="footer-contact-link" href="/contacto">Hablemos →</Link></div><small>© 2026 Vera Studio · Argentina</small></footer>;
}
