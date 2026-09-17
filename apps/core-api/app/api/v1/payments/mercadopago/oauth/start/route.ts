import {createOAuthAttempt, mercadoPagoAuthorizationUrl, requireAdmin, supabase} from '@nadav/adapters';
import {createHash} from 'node:crypto';
import {coreContext} from '../../../../../../../server/context';

export async function GET(request: Request) {
  try {
    requireAdmin(request);
    const context = await coreContext();
    const sessionHash = createHash('sha256').update(request.headers.get('cookie') ?? '').digest('hex');
    const attempt = createOAuthAttempt(context.restaurantId, 'dedicated-owner', sessionHash);
    await supabase('core_mp_oauth_attempts', {method: 'POST', prefer: 'return=minimal', body: attempt.row});
    return Response.redirect(mercadoPagoAuthorizationUrl(attempt.state, attempt.challenge));
  } catch { return Response.json({error: 'Not authorized.'}, {status: 401}); }
}
