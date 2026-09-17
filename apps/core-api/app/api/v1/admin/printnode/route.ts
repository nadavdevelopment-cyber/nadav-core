import {connectPrintNode, disconnectPrintNode, errorResponse, listPrinters, openSecret, readJson, requireAdmin, selectPrinter, supabase, testPrint} from '@nadav/adapters';
import {asObject} from '@nadav/adapters';
import {coreContext} from '../../../../../server/context';

export async function POST(request: Request) {
  try {
    requireAdmin(request);
    const body = asObject(await readJson(request, 5000));
    const context = await coreContext();
    if (!context.config.features.printNode) throw new Error('PrintNode is disabled.');
    const action = String(body.action ?? '');
    if (action === 'connect') return Response.json({printers: await connectPrintNode(context.restaurantId, String(body.apiKey ?? ''))});
    if (action === 'select') { await selectPrinter(context.restaurantId, Number(body.printerId), body.paper === '58' ? '58' : '80', Boolean(body.auto)); return Response.json({ok: true}); }
    if (action === 'test') { await testPrint(context.restaurantId); return Response.json({ok: true}); }
    if (action === 'disconnect') { await disconnectPrintNode(context.restaurantId); return Response.json({ok: true}); }
    if (action === 'printers') {
      const rows = await supabase<{api_key_ciphertext: string}[]>(`core_print_settings?restaurant_id=eq.${context.restaurantId}&select=api_key_ciphertext`);
      const key = openSecret(rows[0]?.api_key_ciphertext ?? '', context.restaurantId, 'printnode');
      return Response.json({printers: await listPrinters(key)});
    }
    return Response.json({error: 'Unknown action.'}, {status: 400});
  } catch (error) { return errorResponse(error); }
}
