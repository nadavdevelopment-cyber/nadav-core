import {createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual} from 'node:crypto';

function encryptionKey(name: 'MERCADOPAGO_TOKEN_ENCRYPTION_KEY' | 'PRINTNODE_TOKEN_ENCRYPTION_KEY') {
  const encoded = process.env[name] ?? '';
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length !== 32 || bytes.toString('base64') !== encoded) throw new Error(`${name} must contain exactly 32 base64 bytes.`);
  return bytes;
}

export function sealSecret(value: string, restaurantId: string, purpose: 'mercadopago' | 'printnode') {
  const variable = purpose === 'mercadopago' ? 'MERCADOPAGO_TOKEN_ENCRYPTION_KEY' : 'PRINTNODE_TOKEN_ENCRYPTION_KEY';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(variable), iv);
  cipher.setAAD(Buffer.from(`nadav-core:${purpose}:${restaurantId}`));
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function openSecret(value: string, restaurantId: string, purpose: 'mercadopago' | 'printnode') {
  const [version, nonce, tag, payload, ...extra] = value.split('.');
  if (version !== 'v1' || !nonce || !tag || !payload || extra.length) throw new Error('Encrypted credential is invalid.');
  const variable = purpose === 'mercadopago' ? 'MERCADOPAGO_TOKEN_ENCRYPTION_KEY' : 'PRINTNODE_TOKEN_ENCRYPTION_KEY';
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(variable), Buffer.from(nonce, 'base64url'));
  decipher.setAAD(Buffer.from(`nadav-core:${purpose}:${restaurantId}`));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(payload, 'base64url')), decipher.final()]).toString('utf8');
}

export function verifyMercadoPagoSignature(signature: string | null, requestId: string | null, dataId: string | null, secret: string) {
  if (!signature || !requestId || !dataId || !/^\d{1,24}$/.test(dataId) || requestId.length > 200 || !secret) return false;
  const fields = Object.fromEntries(signature.split(',').map(part => part.trim().split('=', 2)));
  if (!/^\d{10,16}$/.test(fields.ts ?? '') || !/^[0-9a-f]{64}$/i.test(fields.v1 ?? '')) return false;
  const expected = createHmac('sha256', secret).update(`id:${dataId};request-id:${requestId};ts:${fields.ts};`).digest();
  const actual = Buffer.from(fields.v1, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
