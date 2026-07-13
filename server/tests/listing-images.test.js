import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import sharp from 'sharp';
import { getThumbnailPath, saveListingImage } from '../lib/listing-images.js';

test('saveListingImage creates full and thumbnail WebP variants', async () => {
  const uploadsDir = await mkdtemp(path.join(tmpdir(), 'larrys-images-'));

  try {
    const input = await sharp({
      create: {
        width: 3000,
        height: 2000,
        channels: 3,
        background: '#336699',
      },
    }).jpeg().toBuffer();

    const saved = await saveListingImage(input, uploadsDir);
    const fullBuffer = await readFile(path.join(uploadsDir, path.basename(saved.imagePath)));
    const thumbnailBuffer = await readFile(path.join(uploadsDir, path.basename(saved.thumbnailPath)));
    const fullMetadata = await sharp(fullBuffer).metadata();
    const thumbnailMetadata = await sharp(thumbnailBuffer).metadata();

    assert.match(saved.imagePath, /-full\.webp$/);
    assert.equal(saved.thumbnailPath, getThumbnailPath(saved.imagePath));
    assert.deepEqual(
      [fullMetadata.format, fullMetadata.width, fullMetadata.height],
      ['webp', 2400, 1600],
    );
    assert.deepEqual(
      [thumbnailMetadata.format, thumbnailMetadata.width, thumbnailMetadata.height],
      ['webp', 480, 320],
    );
  } finally {
    await rm(uploadsDir, { recursive: true, force: true });
  }
});

test('getThumbnailPath keeps legacy image paths unchanged', () => {
  assert.equal(getThumbnailPath('/uploads/legacy.jpg'), '/uploads/legacy.jpg');
});
