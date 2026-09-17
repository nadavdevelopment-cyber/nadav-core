import {randomUUID} from 'node:crypto';

export type MediaKind = 'logo' | 'cover' | 'product';
const bucket = 'nadav-core-media';
function config() {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error('Supabase Storage is not configured.');
  return {base, key};
}
function imageType(bytes: Uint8Array) {
  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return {mime: 'image/jpeg', ext: 'jpg'};
  if (bytes.length >= 12 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) return {mime: 'image/png', ext: 'png'};
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return {mime: 'image/webp', ext: 'webp'};
  return null;
}
export function validMediaPath(restaurantId: string, path: string) {
  return new RegExp(`^${restaurantId}/(logo|cover|product)/[0-9a-f-]{36}\\.(jpg|png|webp)$`, 'i').test(path);
}
export async function uploadMedia(restaurantId: string, kind: MediaKind, bytes: Uint8Array) {
  if (bytes.byteLength === 0 || bytes.byteLength > 2 * 1024 * 1024) throw new Error('Image must not exceed 2 MB.');
  const type = imageType(bytes);
  if (!type) throw new Error('Only valid JPG, PNG and WebP images are accepted.');
  const path = `${restaurantId}/${kind}/${randomUUID()}.${type.ext}`;
  const {base, key} = config();
  const response = await fetch(`${base}/storage/v1/object/${bucket}/${path}`, {method: 'POST', headers: {apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': type.mime, 'x-upsert': 'false'}, body: Buffer.from(bytes), signal: AbortSignal.timeout(15_000)});
  if (!response.ok) throw new Error('Image upload failed.');
  return {path, url: `${base}/storage/v1/object/public/${bucket}/${path}`};
}
