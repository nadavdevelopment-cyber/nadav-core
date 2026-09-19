'use client';

import {FormEvent, useState} from 'react';
import {useRouter} from 'next/navigation';
import {veraClient} from '../lib/client';

export function AdminLogin() {
  const router = useRouter(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(''); try { await veraClient().commerce.admin.login(email, password); router.replace('/admin'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos iniciar sesión.'); setSaving(false); } };
  return <main className="commerce-auth"><div className="commerce-auth__card"><p className="eyebrow">Vera Studio · administración</p><h1>Entrar al estudio.</h1><p>Gestioná tu catálogo, pedidos y contenido desde un único lugar.</p><form onSubmit={submit}><label>Email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)}/></label><label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)}/></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={saving}>{saving ? 'Ingresando…' : 'Ingresar'}</button></form><a href="/">Volver a la tienda</a></div></main>;
}
