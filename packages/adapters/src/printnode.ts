import {randomBytes} from 'node:crypto';
import type {Order} from '@nadav/core';
import {openSecret, sealSecret} from './crypto.ts';
import {rpc, supabase} from './supabase.ts';

export type Printer = {id: number; name: string; computer?: {name?: string}};
type PrintSettings = {restaurant_id: string; printer_id: number | null; paper: '58' | '80'; auto_enabled: boolean; api_key_ciphertext: string | null};
const endpoint = 'https://api.printnode.com';

function validKey(key: string) { return typeof key === 'string' && key.length >= 16 && key.length <= 300 && !/\s/.test(key); }
function validPrinter(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) > 0; }

async function request<T>(key: string, path: string, options?: {method: 'POST'; body: unknown; idempotencyKey: string}) {
  if (!validKey(key)) throw new Error('Invalid PrintNode API key.');
  const response = await fetch(`${endpoint}${path}`, {method: options?.method ?? 'GET', headers: {Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`, Accept: 'application/json', ...(options ? {'Content-Type': 'application/json', 'X-Idempotency-Key': options.idempotencyKey} : {})}, body: options ? JSON.stringify(options.body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(12_000)});
  if (!response.ok) throw new Error(`PrintNode request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

function normalizePrinter(value: unknown): Printer | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as {id?: unknown; name?: unknown; computer?: {name?: unknown}};
  return validPrinter(row.id) && typeof row.name === 'string' ? {id: row.id, name: row.name.slice(0, 160), computer: typeof row.computer?.name === 'string' ? {name: row.computer.name.slice(0, 160)} : undefined} : null;
}

export async function listPrinters(key: string) {
  const rows = await request<unknown[]>(key, '/printers');
  if (!Array.isArray(rows)) throw new Error('PrintNode returned an invalid printer list.');
  return rows.map(normalizePrinter).filter((row): row is Printer => Boolean(row));
}

export async function connectPrintNode(restaurantId: string, key: string) {
  const printers = await listPrinters(key);
  await supabase('core_print_settings?on_conflict=restaurant_id', {method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: {restaurant_id: restaurantId, api_key_ciphertext: sealSecret(key, restaurantId, 'printnode'), printer_id: null, auto_enabled: false, updated_at: new Date().toISOString()}});
  return printers;
}

async function connection(restaurantId: string) {
  const rows = await supabase<PrintSettings[]>(`core_print_settings?restaurant_id=eq.${restaurantId}&select=*`);
  const row = rows[0];
  if (!row?.api_key_ciphertext) throw new Error('PrintNode is not connected.');
  return {row, key: openSecret(row.api_key_ciphertext, restaurantId, 'printnode')};
}

export async function selectPrinter(restaurantId: string, printerId: number, paper: '58' | '80', auto: boolean) {
  const {key} = await connection(restaurantId);
  const printers = await listPrinters(key);
  if (!printers.some(printer => printer.id === printerId)) throw new Error('Printer does not belong to this PrintNode account.');
  await supabase(`core_print_settings?restaurant_id=eq.${restaurantId}`, {method: 'PATCH', prefer: 'return=minimal', body: {printer_id: printerId, paper, auto_enabled: auto, updated_at: new Date().toISOString()}});
}

export async function disconnectPrintNode(restaurantId: string) {
  await supabase(`core_print_settings?restaurant_id=eq.${restaurantId}`, {method: 'PATCH', prefer: 'return=minimal', body: {api_key_ciphertext: null, printer_id: null, auto_enabled: false, updated_at: new Date().toISOString()}});
}

export function receiptText(order: Order, restaurantName: string) {
  const lines = [restaurantName, `PEDIDO #${order.number}`, new Date(order.createdAt).toLocaleString('es-AR'), `Cliente: ${order.customer.name}`, `Teléfono: ${order.customer.phone}`, `Modalidad: ${order.mode === 'delivery' ? 'Delivery' : 'Retiro'}`];
  if (order.address) lines.push(`Dirección: ${order.address}`);
  lines.push('--------------------------------');
  for (const item of order.items) {
    lines.push(`${item.quantity} x ${item.name}  $${item.lineTotal}`);
    for (const modifier of item.modifiers) lines.push(`  + ${modifier.groupName}: ${modifier.name}${modifier.price ? ` $${modifier.price}` : ''}`);
    if (item.notes) lines.push(`  Nota: ${item.notes}`);
  }
  if (order.notes) lines.push(`Nota pedido: ${order.notes}`);
  lines.push('--------------------------------', `Subtotal: $${order.subtotal}`, `Descuento: -$${order.discount}`, `Envío: $${order.deliveryFee}`, `TOTAL: $${order.total}`, `Pago: ${order.paymentMethod} (${order.paymentStatus})`);
  return lines.join('\n');
}

export function receiptPdf(text: string, paper: '58' | '80') {
  const printable = (value: string) => value.replace(/[^\x20-\x7e\xa0-\xff]/g, '?');
  const escape = (value: string) => printable(value).replace(/[\\()]/g, '\\$&');
  const width = paper === '58' ? 164 : 227;
  const chars = paper === '58' ? 26 : 38;
  const rows = text.split('\n').flatMap(line => printable(line).match(new RegExp(`.{1,${chars}}`, 'g')) ?? ['']);
  const height = Math.max(100, rows.length * 12 + 32);
  const stream = `BT /F1 9 Tf 12 TL 9 ${height - 18} Td ${rows.map((line, index) => `${index ? 'T* ' : ''}(${escape(line)}) Tj`).join('\n')} ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>', `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }
  const start = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(pdf, 'latin1').toString('base64');
}

export async function testPrint(restaurantId: string) {
  const {row, key} = await connection(restaurantId);
  if (!row.printer_id) throw new Error('Select a printer first.');
  const printers = await listPrinters(key);
  if (!printers.some(printer => printer.id === row.printer_id)) throw new Error('Selected printer no longer belongs to the account.');
  return request<number>(key, '/printjobs', {method: 'POST', idempotencyKey: `test-${restaurantId}-${randomBytes(16).toString('hex')}`, body: {printerId: row.printer_id, title: 'NADAV Core - prueba', contentType: 'pdf_base64', content: receiptPdf('NADAV Core\nImpresión de prueba\nLa impresora está conectada.', row.paper), source: 'NADAV Core'}});
}

type ClaimedJob = {id: string; restaurant_id: string; printer_id: number; paper: '58' | '80'; order: Order; restaurant_name: string; idempotency_key: string; api_key_ciphertext: string};
export async function dispatchPrintJob(jobId: string) {
  const job = await rpc<ClaimedJob | null>('core_claim_print_job', {p_id: jobId});
  if (!job) return false;
  try {
    const key = openSecret(job.api_key_ciphertext, job.restaurant_id, 'printnode');
    const remote = await request<number>(key, '/printjobs', {method: 'POST', idempotencyKey: job.idempotency_key, body: {printerId: job.printer_id, title: `${job.restaurant_name} - pedido #${job.order.number}`, contentType: 'pdf_base64', content: receiptPdf(receiptText(job.order, job.restaurant_name), job.paper), source: 'NADAV Core'}});
    await supabase(`core_print_jobs?id=eq.${job.id}&status=eq.processing`, {method: 'PATCH', prefer: 'return=minimal', body: {status: 'submitted', remote_job_id: remote, updated_at: new Date().toISOString()}});
    return true;
  } catch (error) {
    await supabase(`core_print_jobs?id=eq.${job.id}&status=eq.processing`, {method: 'PATCH', prefer: 'return=minimal', body: {status: 'failed', error_code: error instanceof Error ? error.message.slice(0, 120) : 'PRINT_ERROR', updated_at: new Date().toISOString()}}).catch(() => undefined);
    return false;
  }
}
