import {errorResponse, retryPrintJobs, rpc} from '@nadav/adapters';
import {coreContext} from '../../../../server/context';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET ?? '';
  const authorization = request.headers.get('authorization') ?? '';
  if (secret.length < 32 || authorization !== `Bearer ${secret}`) {
    return Response.json({error: {code: 'NO_AUTH', message: 'No autorizado.'}}, {status: 401});
  }
  try {
    const context = await coreContext();
    await rpc<void>('core_purge_expired', {});
    const printing = context.config.features.printNode
      ? await retryPrintJobs(context.restaurantId, 20)
      : {checked: 0, submitted: 0};
    return Response.json({ok: true, printing}, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    return errorResponse(error);
  }
}
