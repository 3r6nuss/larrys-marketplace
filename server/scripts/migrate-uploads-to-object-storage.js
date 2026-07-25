import 'dotenv/config';
import path from 'path';
import { readFile, readdir } from 'fs/promises';
import db from '../db.js';
import { getImageStorageDriver, storeImage } from '../lib/image-storage.js';

const uploadsDir = path.join(process.cwd(), 'uploads');

async function migrateUploads() {
  if (getImageStorageDriver() !== 's3') {
    throw new Error('Set IMAGE_STORAGE=s3 before running this migration.');
  }

  const entries = await readdir(uploadsDir, { withFileTypes: true });
  const files = entries.filter(entry => entry.isFile());
  const mappings = [];

  for (const [index, entry] of files.entries()) {
    const buffer = await readFile(path.join(uploadsDir, entry.name));
    const storedPath = await storeImage(entry.name, buffer, uploadsDir);
    mappings.push({ oldPath: `/uploads/${entry.name}`, storedPath });
    console.log(`[${index + 1}/${files.length}] Uploaded ${entry.name}`);
  }

  for (const { oldPath, storedPath } of mappings) {
    await db.query('UPDATE listings SET image_path = ? WHERE image_path = ?', [storedPath, oldPath]);
    await db.query('UPDATE listing_images SET image_path = ? WHERE image_path = ?', [storedPath, oldPath]);
  }

  const [legacyListings, legacyImages] = await Promise.all([
    db.query("SELECT COUNT(*) AS count FROM listings WHERE image_path LIKE '/uploads/%'"),
    db.query("SELECT COUNT(*) AS count FROM listing_images WHERE image_path LIKE '/uploads/%'"),
  ]);
  const remainingReferences = Number(legacyListings.rows[0]?.count || 0)
    + Number(legacyImages.rows[0]?.count || 0);
  if (remainingReferences > 0) {
    throw new Error(`${remainingReferences} database image references have no matching file in the upload volume.`);
  }

  console.log(`Migrated ${files.length} upload files. Local files were kept for rollback.`);
}

try {
  await migrateUploads();
} catch (error) {
  console.error('Upload migration failed:', error.message);
  process.exitCode = 1;
} finally {
  if (db.pool) await db.pool.end();
}