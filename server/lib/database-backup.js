export const BACKUP_VERSION = 1;

export const BACKUP_TABLES = Object.freeze({
  users: {
    label: 'Benutzer',
    columns: ['id', 'discord_id', 'username', 'display_name', 'first_name', 'last_name', 'avatar_url', 'role', 'is_blocked', 'blocked_by', 'blocked_at', 'created_at', 'last_login', 'discord_notifications', 'has_completed_profile'],
  },
  vehicle_catalog: {
    label: 'Fahrzeugkatalog',
    columns: ['id', 'brand', 'model', 'coin_price', 'min_dollar_price', 'max_dollar_price', 'dealer_price', 'min_sell_price', 'max_sell_price', 'created_at'],
  },
  listings: {
    label: 'Fahrzeuginserate',
    columns: ['id', 'catalog_id', 'seller_id', 'brand', 'model', 'plate', 'category', 'status', 'custom_price', 'discount_pct', 'image_path', 'notes', 'view_count', 'listed_at', 'sold_at', 'sold_by', 'sold_to_name', 'sold_price', 'is_featured'],
  },
  listing_images: {
    label: 'Fahrzeugbilder',
    columns: ['id', 'listing_id', 'image_path', 'sort_order', 'is_cover', 'uploaded_at'],
  },
  tickets: {
    label: 'Tickets',
    columns: ['id', 'listing_id', 'customer_id', 'assigned_to', 'status', 'priority', 'created_at', 'updated_at', 'closed_at', 'last_read_customer', 'last_read_staff', 'erp_status', 'contract_price', 'contract_payment_type', 'contract_created_at'],
  },
  ticket_messages: {
    label: 'Ticket-Nachrichten',
    columns: ['id', 'ticket_id', 'sender_id', 'message', 'created_at'],
  },
  vault_entries: {
    label: 'Tresor-Einträge',
    columns: ['id', 'listing_id', 'owner_id', 'sold_by_id', 'amount', 'status', 'note', 'created_at', 'paid_out_at', 'confirmed_by'],
  },
  reviews: {
    label: 'Bewertungen',
    columns: ['id', 'listing_id', 'seller_id', 'customer_id', 'rating', 'comment', 'created_at'],
  },
  vehicle_requests: {
    label: 'Wunschfahrzeuge',
    columns: ['id', 'customer_id', 'brand', 'model', 'notes', 'status', 'matched_listing_id', 'handled_by', 'created_at', 'updated_at'],
  },
  vehicle_request_messages: {
    label: 'Wunschfahrzeug-Nachrichten',
    columns: ['id', 'request_id', 'sender_id', 'message', 'created_at'],
  },
});

export function getSelectedBackupTables(tables) {
  if (!Array.isArray(tables)) return [];
  return [...new Set(tables)].filter(table => Object.hasOwn(BACKUP_TABLES, table));
}

export function validateBackupImport(backup, requestedTables) {
  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
    throw new Error('Ungültige Backup-Datei.');
  }
  if (backup.version !== BACKUP_VERSION || !backup.tables || typeof backup.tables !== 'object') {
    throw new Error('Backup-Version wird nicht unterstützt.');
  }

  const selectedTables = getSelectedBackupTables(requestedTables);
  if (selectedTables.length === 0) throw new Error('Keine gültige Tabelle ausgewählt.');

  for (const table of selectedTables) {
    const rows = backup.tables[table];
    if (!Array.isArray(rows)) throw new Error(`Tabelle ${table} fehlt im Backup.`);
    const allowedColumns = new Set(BACKUP_TABLES[table].columns);
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        throw new Error(`Ungültiger Datensatz in ${table}.`);
      }
      const invalidColumn = Object.keys(row).find(column => !allowedColumns.has(column));
      if (invalidColumn) throw new Error(`Unbekannte Spalte ${invalidColumn} in ${table}.`);
    }
  }

  return selectedTables;
}

export function createInsertStatement(table, row, postgres = false) {
  const columns = BACKUP_TABLES[table].columns.filter(column => Object.hasOwn(row, column));
  if (columns.length === 0) throw new Error(`Leerer Datensatz in ${table}.`);
  const placeholders = columns.map((_, index) => postgres ? `$${index + 1}` : '?');
  return {
    sql: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
    values: columns.map(column => row[column]),
  };
}