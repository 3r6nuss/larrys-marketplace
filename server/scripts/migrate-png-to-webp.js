import path from 'path';
import { readdir, unlink } from 'fs/promises';
import db from '../db.js';
import { deleteListingImageFiles, saveListingImage } from '../lib/listing-images.js';

const applyChanges = process.argv.includes('--apply');
const uploadsDir = path.join(process.cwd(), 'uploads');

async function updateImageReferences(oldPath, newPath) {
  try {
    const listings = await db.query(
      'UPDATE listings SET image_path = ? WHERE image_path = ?',
      [newPath, oldPath],
    );
    const listingImages = await db.query(
      'UPDATE listing_images SET image_path = ? WHERE image_path = ?',
      [newPath, oldPath],
    );
    return (listings.rowCount || 0) + (listingImages.rowCount || 0);
  } catch (error) {
    await Promise.allSettled([
      db.query('UPDATE listings SET image_path = ? WHERE image_path = ?', [oldPath, newPath]),
      db.query('UPDATE listing_images SET image_path = ? WHERE image_path = ?', [oldPath, newPath]),
    ]);
    throw error;
  }
}

async function migratePng(filename) {
  const sourcePath = path.join(uploadsDir, filename);
  const oldImagePath = `/uploads/${filename}`;

  if (!applyChanges) {
    console.log(`[Vorschau] ${oldImagePath}`);
    return { converted: false, failed: false };
  }

  let saved;
  let referencesUpdated = false;
  try {
    saved = await saveListingImage(sourcePath, uploadsDir);
    const references = await updateImageReferences(oldImagePath, saved.imagePath);
    referencesUpdated = true;
    await unlink(sourcePath);
    console.log(`[Konvertiert] ${oldImagePath} -> ${saved.imagePath} (${references} DB-Referenzen)`);
    return { converted: true, failed: false };
  } catch (error) {
    if (saved && referencesUpdated) {
      try {
        await updateImageReferences(saved.imagePath, oldImagePath);
        referencesUpdated = false;
      } catch (rollbackError) {
        console.error(`[Kritisch] DB-Rollback für ${oldImagePath} fehlgeschlagen: ${rollbackError.message}`);
      }
    }
    if (saved && !referencesUpdated) await deleteListingImageFiles(saved.imagePath, uploadsDir);
    console.error(`[Fehler] ${oldImagePath}: ${error.message}`);
    return { converted: false, failed: true };
  }
}

async function main() {
  const entries = await readdir(uploadsDir, { withFileTypes: true });
  const pngFiles = entries
    .filter(entry => entry.isFile() && /\.png$/i.test(entry.name))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (pngFiles.length === 0) {
    console.log('Keine PNG-Dateien im Upload-Ordner gefunden.');
    return;
  }

  console.log(`${pngFiles.length} PNG-Datei(en) gefunden. Modus: ${applyChanges ? 'AUSFÜHREN' : 'VORSCHAU'}`);
  const results = [];
  for (const filename of pngFiles) results.push(await migratePng(filename));

  const converted = results.filter(result => result.converted).length;
  const failed = results.filter(result => result.failed).length;
  if (applyChanges) console.log(`Fertig: ${converted} konvertiert, ${failed} fehlgeschlagen.`);
  else console.log('Keine Dateien geändert. Mit --apply wird die Konvertierung ausgeführt.');

  if (failed > 0) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error(`Migration abgebrochen: ${error.message}`);
  process.exitCode = 1;
} finally {
  await db.pool?.end();
}