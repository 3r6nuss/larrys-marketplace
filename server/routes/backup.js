import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole, logAction } from '../middleware/auth.js';
import {
  BACKUP_TABLES,
  BACKUP_VERSION,
  createInsertStatement,
  getSelectedBackupTables,
  validateBackupImport,
} from '../lib/database-backup.js';

const router = Router();
const requireSuperadmin = [requireAuth, requireRole('superadmin')];

async function restorePostgres(backup, selectedTables) {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const table of [...selectedTables].reverse()) await client.query(`DELETE FROM ${table}`);
    for (const table of selectedTables) {
      for (const row of backup.tables[table]) {
        const statement = createInsertStatement(table, row, true);
        await client.query(statement.sql, statement.values);
      }
      await client.query(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM ${table}`,
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function restoreSqlite(backup, selectedTables) {
  const restore = db.sqlite.transaction(() => {
    for (const table of [...selectedTables].reverse()) db.sqlite.prepare(`DELETE FROM ${table}`).run();
    for (const table of selectedTables) {
      for (const row of backup.tables[table]) {
        const statement = createInsertStatement(table, row);
        db.sqlite.prepare(statement.sql).run(...statement.values);
      }
    }
  });
  restore();
}

router.get('/tables', ...requireSuperadmin, async (req, res) => {
  try {
    const tables = await Promise.all(Object.entries(BACKUP_TABLES).map(async ([name, config]) => {
      const result = await db.query(`SELECT COUNT(*) AS count FROM ${name}`);
      return { name, label: config.label, count: Number.parseInt(result.rows[0]?.count, 10) || 0 };
    }));
    res.json({ version: BACKUP_VERSION, tables });
  } catch (error) {
    console.error('Backup table overview error:', error);
    res.status(500).json({ error: 'Tabellen konnten nicht geladen werden.' });
  }
});

router.post('/export', ...requireSuperadmin, async (req, res) => {
  const selectedTables = getSelectedBackupTables(req.body?.tables);
  if (selectedTables.length === 0) return res.status(400).json({ error: 'Keine gültige Tabelle ausgewählt.' });

  try {
    const tables = {};
    const rowCounts = {};
    for (const table of selectedTables) {
      const columns = BACKUP_TABLES[table].columns.join(', ');
      const result = await db.query(`SELECT ${columns} FROM ${table} ORDER BY id`);
      tables[table] = result.rows;
      rowCounts[table] = result.rows.length;
    }

    const createdAt = new Date().toISOString();
    const backup = {
      version: BACKUP_VERSION,
      metadata: { created_at: createdAt, created_by: req.user.id, row_counts: rowCounts },
      tables,
    };
    const filename = `larrys-backup-${createdAt.slice(0, 19).replaceAll(':', '-')}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(backup);
    await logAction(req.user.id, 'database_backup_exported', 'system', null, { tables: selectedTables, row_counts: rowCounts }, req.ip);
  } catch (error) {
    console.error('Backup export error:', error);
    res.status(500).json({ error: 'Backup konnte nicht erstellt werden.' });
  }
});

router.post('/import', ...requireSuperadmin, async (req, res) => {
  if (req.body?.confirmation !== 'WIEDERHERSTELLEN') {
    return res.status(400).json({ error: 'Bestätigung fehlt.' });
  }

  try {
    const selectedTables = validateBackupImport(req.body?.backup, req.body?.tables);
    if (db.pool) await restorePostgres(req.body.backup, selectedTables);
    else restoreSqlite(req.body.backup, selectedTables);

    const rowCounts = Object.fromEntries(selectedTables.map(table => [table, req.body.backup.tables[table].length]));
    await logAction(req.user.id, 'database_backup_imported', 'system', null, { tables: selectedTables, row_counts: rowCounts }, req.ip);
    res.json({ success: true, tables: selectedTables, row_counts: rowCounts });
  } catch (error) {
    console.error('Backup import error:', error);
    res.status(400).json({ error: error.message || 'Backup konnte nicht wiederhergestellt werden.' });
  }
});

export default router;