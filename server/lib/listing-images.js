import path from 'path';
import { unlink } from 'fs/promises';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

const FULL_IMAGE_OPTIONS = {
  width: 2400,
  quality: 92,
  chromaSubsampling: '4:4:4',
};

const THUMBNAIL_OPTIONS = {
  width: 480,
  quality: 72,
};

export function getThumbnailPath(imagePath) {
  return imagePath?.endsWith('-full.webp')
    ? imagePath.replace(/-full\.webp$/, '-thumb.webp')
    : imagePath;
}

export async function saveListingImage(input, uploadsDir) {
  const basename = `listing-${uuidv4()}`;
  const fullFilename = `${basename}-full.webp`;
  const thumbnailFilename = `${basename}-thumb.webp`;
  const fullFilePath = path.join(uploadsDir, fullFilename);
  const thumbnailFilePath = path.join(uploadsDir, thumbnailFilename);
  const source = sharp(input, { failOn: 'error' }).rotate();

  try {
    await Promise.all([
      source
        .clone()
        .resize({ width: FULL_IMAGE_OPTIONS.width, withoutEnlargement: true })
        .webp({
          quality: FULL_IMAGE_OPTIONS.quality,
          chromaSubsampling: FULL_IMAGE_OPTIONS.chromaSubsampling,
          smartSubsample: true,
        })
        .toFile(fullFilePath),
      source
        .clone()
        .resize({ width: THUMBNAIL_OPTIONS.width, withoutEnlargement: true })
        .webp({ quality: THUMBNAIL_OPTIONS.quality, smartSubsample: true })
        .toFile(thumbnailFilePath),
    ]);
  } catch (error) {
    await Promise.allSettled([unlink(fullFilePath), unlink(thumbnailFilePath)]);
    throw error;
  }

  return {
    imagePath: `/uploads/${fullFilename}`,
    thumbnailPath: `/uploads/${thumbnailFilename}`,
  };
}

export async function deleteListingImageFiles(imagePath, uploadsDir) {
  if (!imagePath?.startsWith('/uploads/')) return;

  const filenames = new Set([
    path.basename(imagePath),
    path.basename(getThumbnailPath(imagePath)),
  ]);
  await Promise.allSettled([...filenames].map(filename => unlink(path.join(uploadsDir, filename))));
}
