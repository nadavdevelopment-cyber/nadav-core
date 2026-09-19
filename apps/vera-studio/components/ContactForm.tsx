'use client';

import {FormEvent, useState} from 'react';

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!data.get('name') || !data.get('email') || !data.get('reason') || !data.get('message')) {
      setError('Completá los campos para poder enviarnos tu consulta.');
      return;
    }
    setError('');
    setSent(true);
  };
  if (sent) return <section className="contact-success" aria-live="polite"><span>V</span><p className="eyebrow">Consulta enviada</p><h2>Gracias por escribirnos.</h2><p>Recibimos tu mensaje. Te vamos a responder apenas podamos.</p></section>;
  return <form className="contact-form" onSubmit={submit} noValidate><div className="form-grid"><label>Nombre<input name="name" autoComplete="name" required/></label><label>Email<input name="email" type="email" autoComplete="email" required/></label><label className="full">Motivo de consulta<select name="reason" defaultValue=""><option value="" disabled>Elegí una opción</option><option value="talle">Talle o calce</option><option value="prenda">Una prenda</option><option value="pedido">Un pedido</option><option value="otro">Otro</option></select></label><label className="full">Mensaje<textarea name="message" rows={6} required/></label></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit">Enviar consulta</button></form>;
}
