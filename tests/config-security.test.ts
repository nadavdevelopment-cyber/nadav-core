import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {createAdminSession, verifyAdminSession} from '../packages/adapters/src/admin-auth.ts';
import {isRestaurantOpen} from '../packages/core/src/hours.ts';
import {config} from './fixtures.ts';

process.env.NADAV_CORE_SESSION_SECRET = 'a-secure-test-secret-with-more-than-32-characters';

test('admin session is signed and expires', () => {
  const now = Date.now();
  const value = createAdminSession(now);
  assert.equal(verifyAdminSession(value, now + 1000), true);
  assert.equal(verifyAdminSession(`${value}tampered`, now), false);
  assert.equal(verifyAdminSession(value, now + 13 * 60 * 60 * 1000), false);
});

test('opening hours support ordinary and overnight schedules', () => {
  assert.equal(isRestaurantOpen(config, new Date('2026-09-16T15:00:00Z')), true);
  const overnight = {...config, hours: {...config.hours, tue: {open: true, from: '20:00', to: '02:00'}, wed: {open: false, from: '00:00', to: '00:00'}}};
  assert.equal(isRestaurantOpen(overnight, new Date('2026-09-16T04:00:00Z')), true);
});

test('database keeps server-only access and transactional invariants', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0001_core_schema.sql', import.meta.url), 'utf8');
  assert.match(sql, /enable row level security/g);
  assert.match(sql, /revoke all on public\.%I from anon, authenticated/);
  assert.match(sql, /create function public\.core_place_order/);
  assert.match(sql, /for update/);
  assert.match(sql, /unique\(restaurant_id,idempotency_key\)/);
  assert.match(sql, /core_print_one_auto_per_order/);
});

test('public SDK and demo never reference server secrets', () => {
  const sdk = readFileSync(new URL('../packages/sdk/src/index.ts', import.meta.url), 'utf8');
  const demo = readFileSync(new URL('../apps/demo/components/DemoStorefront.tsx', import.meta.url), 'utf8');
  for (const source of [sdk, demo]) {
    assert.doesNotMatch(source, /SERVICE_ROLE|CLIENT_SECRET|ENCRYPTION_KEY|PRINTNODE_TOKEN|access_token/);
  }
});
