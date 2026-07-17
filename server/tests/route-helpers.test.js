import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildListingSearchFilter,
  canManageOwnedResource,
  hasDiscordNotificationsEnabled,
  toCount,
  toId,
  toInt,
  userHasRole,
} from '../lib/route-helpers.js';

test('toInt parses numeric strings with base 10', () => {
  assert.equal(toInt('42'), 42);
  assert.equal(toInt('08'), 8);
});

test('toInt and toId return fallback/null for invalid values', () => {
  assert.equal(toInt('abc', -1), -1);
  assert.equal(toId('abc'), null);
});

test('toCount normalizes invalid and empty values to 0', () => {
  assert.equal(toCount(undefined), 0);
  assert.equal(toCount('not-a-number'), 0);
  assert.equal(toCount('15'), 15);
});

test('buildListingSearchFilter searches every term case-insensitively across vehicle fields', () => {
  assert.deepEqual(buildListingSearchFilter('  bMw   M3 '), {
    clause: '(l.brand ILIKE ? OR l.model ILIKE ? OR l.plate ILIKE ?) AND (l.brand ILIKE ? OR l.model ILIKE ? OR l.plate ILIKE ?)',
    params: ['%bMw%', '%bMw%', '%bMw%', '%M3%', '%M3%', '%M3%'],
  });
  assert.deepEqual(buildListingSearchFilter('   '), { clause: null, params: [] });
});

test('userHasRole supports Set and Array role collections', () => {
  const user = { role: 'mitarbeiter' };
  assert.equal(userHasRole(user, new Set(['kunde', 'mitarbeiter'])), true);
  assert.equal(userHasRole(user, ['kunde', 'inhaber']), false);
  assert.equal(userHasRole(null, ['mitarbeiter']), false);
});

test('canManageOwnedResource allows owner or admin roles', () => {
  const owner = { id: 11, role: 'kunde' };
  const admin = { id: 50, role: 'superadmin' };
  const other = { id: 12, role: 'kunde' };
  const adminRoles = new Set(['superadmin', 'stv_admin', 'inhaber']);

  assert.equal(canManageOwnedResource(11, owner, adminRoles), true);
  assert.equal(canManageOwnedResource(11, admin, adminRoles), true);
  assert.equal(canManageOwnedResource(11, other, adminRoles), false);
});

test('hasDiscordNotificationsEnabled requires discord_id and enabled flag', () => {
  assert.equal(hasDiscordNotificationsEnabled({ discord_id: '123', discord_notifications: 1 }), true);
  assert.equal(hasDiscordNotificationsEnabled({ discord_id: '123', discord_notifications: true }), true);
  assert.equal(hasDiscordNotificationsEnabled({ discord_id: null, discord_notifications: 1 }), false);
  assert.equal(hasDiscordNotificationsEnabled({ discord_id: '123', discord_notifications: 0 }), false);
});
