export default async function AdminLogin({searchParams}: {searchParams: Promise<{error?: string}>}) {
  const {error} = await searchParams;
  return <main className="login-card"><span className="core-mark">N</span><p>NADAV CORE ADMIN</p><h1>Administración del restaurante</h1><p>Ingresá la credencial privada de esta instalación.</p>{error ? <p role="alert">{error === 'rate' ? 'Demasiados intentos. Esperá unos minutos.' : 'Credencial inválida.'}</p> : null}<form action="/api/v1/admin/session" method="post"><label>Credencial administrativa<input type="password" name="token" autoComplete="current-password" required/></label><button type="submit">Ingresar</button></form></main>;
}
