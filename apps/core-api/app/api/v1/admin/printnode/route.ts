import {connectPrintNode, disconnectPrintNode, errorResponse, listPrinters, openSecret, readJson, reprintOrder, requireAdmin, retryPrintJobs, selectPrinter, supabase, testPrint} from '@nadav/adapters';
import {asObject} from '@nadav/adapters';
import {CoreError, unavailable} from '@nadav/core';
import {coreContext} from '../../../../../server/context';

export async function POST(request: Request) {
  try {
    requireAdmin(request);
    const body = asObject(await readJson(request, 5000, {adminOnly: true}));
    const context = await coreContext();
    if (!context.config.features.printNode) throw unavailable('PrintNode no está habilitado.');
    const action = String(body.action ?? '');
    if (action === 'connect') return Response.json({printers: await connectPrintNode(context.restaurantId, String(body.apiKey ?? ''))});
    if (action === 'select') { await selectPrinter(context.restaurantId, Number(body.printerId), body.paper === '58' ? '58' : '80', Boolean(body.auto)); return Response.json({ok: true}); }
    if (action === 'test') { await testPrint(context.restaurantId); return Response.json({ok: true}); }
    if (action === 'disconnect') { await disconnectPrintNode(context.restaurantId); return Response.json({ok: true}); }
    if (action === 'reprint') {
      const ok = await reprintOrder(context.restaurantId, String(body.orderId ?? ''));
      await context.repository.audit({restaurantId: context.restaurantId, action: 'order.reprinted', details: {orderId: String(body.orderId), ok}});
      return Response.json({ok}, {status: ok ? 200 : 502});
    }
    if (action === 'retry_failed') {
      const result = await retryPrintJobs(context.restaurantId, 20);
      await context.repository.audit({restaurantId: context.restaurantId, action: 'print.retry_batch', details: result});
      return Response.json(result);
    }
    if (action === 'printers') {
      const rows = await supabase<{api_key_ciphertext: string | null}[]>(`core_print_settings?restaurant_id=eq.${encodeURIComponent(context.restaurantId)}&select=api_key_ciphertext`);
      if (!rows[0]?.api_key_ciphertext) throw unavailable('PrintNode no está conectado.');
      const key = openSecret(rows[0].api_key_ciphertext, context.restaurantId, 'printnode');
      return Response.json({printers: await listPrinters(key)});
    }
    throw new CoreError('INVALID_INPUT', 'Acción desconocida.', 400);
  } catch (error) { return errorResponse(error); }
}
