import {ContactForm} from '../../components/ContactForm';
import {InfoPage} from '../../components/InfoPage';

export default function ContactPage() {
  return <InfoPage eyebrow="Contacto" title={<>¿Necesitás<br/><em>ayuda?</em></>} lead="Si tenés dudas sobre un talle, una prenda o tu pedido, escribinos. Tratamos de responder cada consulta lo antes posible."><section className="contact-layout"><p>Vera es un estudio chico y cada mensaje se lee con atención. Contanos qué necesitás para que podamos orientarte mejor.</p><ContactForm/></section></InfoPage>;
}
