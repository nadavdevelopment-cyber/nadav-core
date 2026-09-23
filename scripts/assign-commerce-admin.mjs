const base = String(process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
// COMMERCE_* names are generic; the VERA_* ones keep working.
const email = process.env.COMMERCE_ADMIN_EMAIL ?? process.env.VERA_ADMIN_EMAIL;
const slug = process.env.COMMERCE_STORE_SLUG ?? process.env.VERA_RESTAURANT_SLUG ?? 'vera-studio';
const role = process.env.COMMERCE_ADMIN_ROLE ?? process.env.VERA_ADMIN_ROLE ?? 'owner';
if (!base || !service || !email) throw new Error('Definí SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y COMMERCE_ADMIN_EMAIL.');
const headers = {apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation'};
async function get(path) { const response = await fetch(`${base}${path}`, {headers}); if (!response.ok) throw new Error(`Supabase respondió ${response.status}.`); return response.json(); }
const users = await get('/auth/v1/admin/users?per_page=1000');
const user = users.users?.find(row => row.email?.toLowerCase() === email.toLowerCase());
if (!user?.id) throw new Error(`No existe un usuario Auth con email ${email}. Crealo primero en Supabase Auth.`);
const restaurants = await get(`/rest/v1/core_restaurants?slug=eq.${encodeURIComponent(slug)}&select=id`);
if (!restaurants[0]?.id) throw new Error(`No existe el tenant ${slug}. Aplicá la migración Commerce.`);
const response = await fetch(`${base}/rest/v1/core_commerce_members`, {method: 'POST', headers, body: JSON.stringify({restaurant_id: restaurants[0].id, user_id: user.id, role})});
if (!response.ok) throw new Error(`No se pudo asignar el rol (${response.status}).`);
console.log(`Asignado ${email} como ${role} en ${slug}.`);
