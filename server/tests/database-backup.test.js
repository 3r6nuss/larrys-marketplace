import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKUP_VERSION,
  createInsertStatement,
  getSelectedBackupTables,
  validateBackupImport,
} from '../lib/database-backup.js';

test('getSelectedBackupTables removes duplicates and rejects unknown tables', () => {
  assert.deepEqual(
    getSelectedBackupTables(['listings', 'session', 'listings', 'audit_log']),
    ['listings'],
  );
});

test('validateBackupImport only accepts allowlisted columns and selected tables', () => {
  const backup = {
    version: BACKUP_VERSION,
    tables: { listings: [{ id: 1, seller_id: 2, brand: 'Obey', model: 'Tailgater' }] },
  };
  assert.deepEqual(validateBackupImport(backup, ['listings']), ['listings']);
  assert.throws(
    () => validateBackupImport({ ...backup, tables: { listings: [{ id: 1, password: 'x' }] } }, ['listings']),
    /Unbekannte Spalte password/,
  );
  assert.throws(() => validateBackupImport(backup, ['session']), /Keine gültige Tabelle/);
});

test('createInsertStatement uses database-specific placeholders', () => {
  const row = { id: 4, brand: 'Annis', model: 'Elegy' };
  assert.deepEqual(createInsertStatement('vehicle_catalog', row), {
    sql: 'INSERT INTO vehicle_catalog (id, brand, model) VALUES (?, ?, ?)',
    values: [4, 'Annis', 'Elegy'],
  });
  assert.equal(
    createInsertStatement('vehicle_catalog', row, true).sql,
    'INSERT INTO vehicle_catalog (id, brand, model) VALUES ($1, $2, $3)',
  );
});