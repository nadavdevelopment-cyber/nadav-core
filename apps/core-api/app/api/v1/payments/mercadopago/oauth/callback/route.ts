import {createHash} from 'node:crypto';
import {requireAdmin, rpc, saveMercadoPagoTokens, tokenRequest} from '@nadav/adapters';
import {coreContext} from '../../../../../../../server/context';

export async function GET(request: Request) {
  const origin = process.env.APP_ORIGIN ?? new URL(request.url).origin;
  try {
    requireAdmin(request);
    const url = new URL(request.url);
    const state = url.searchParams.get('state') ?? '';
    const code = url.searchParams.get('code') ?? '';
    if (!/^[A-Za-z0-9_-]{43}$/.test(state) || !code || code.length > 2048) throw new Error('Invalid OAuth callback.');
    const context = await coreContext();
    const stateHash = createHash('sha256').update(state).digest('base64url');
    const sessionHash = createHash('sha256').update(request.headers.get('cookie') ?? '').digest('hex');
    const verifier = await rpc<string | null>('core_mp_consume_attempt', {p_hash: stateHash, p_restaurant: context.restaurantId, p_user: 'dedicated-owner', p_session_hash: sessionHash});
    if (!verifier) throw new Error('OAuth attempt expired.');
    const clientId = process.env.MERCADOPAGO_CLIENT_ID ?? '';
    const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET ?? '';
    const redirectUri = process.env.MERCADOPAGO_REDIRECT_URI ?? '';
    const tokens = await tokenRequest({client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier});
    await saveMercadoPagoTokens(context.restaurantId, tokens);
    return Response.redirect(`${origin}/admin?mercadopago=connected`);
  } catch (error) {
    console.error('Mercado Pago OAuth callback failed', error instanceof Error ? error.message : 'unknown');
    return Response.redirect(`${origin}/admin?mercadopago=error`);
  }
}
