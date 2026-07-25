import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { deleteStoredImage, getStoredImagePath, storeImage } from './image-storage.js';

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
  const source = sharp(input, { failOn: 'error' }).rotate();
  const imagePath = getStoredImagePath(fullFilename);
  const thumbnailPath = getStoredImagePath(thumbnailFilename);

  try {
    const [fullBuffer, thumbnailBuffer] = await Promise.all([
      source
        .clone()
        .resize({ width: FULL_IMAGE_OPTIONS.width, withoutEnlargement: true })
        .webp({
          quality: FULL_IMAGE_OPTIONS.quality,
          chromaSubsampling: FULL_IMAGE_OPTIONS.chromaSubsampling,
          smartSubsample: true,
        })
        .toBuffer(),
      source
        .clone()
        .resize({ width: THUMBNAIL_OPTIONS.width, withoutEnlargement: true })
        .webp({ quality: THUMBNAIL_OPTIONS.quality, smartSubsample: true })
        .toBuffer(),
    ]);

    await storeImage(fullFilename, fullBuffer, uploadsDir);
    await storeImage(thumbnailFilename, thumbnailBuffer, uploadsDir);
  } catch (error) {
    await Promise.allSettled([
      deleteStoredImage(imagePath, uploadsDir),
      deleteStoredImage(thumbnailPath, uploadsDir),
    ]);
    throw error;
  }

  return { imagePath, thumbnailPath };
}

export async function deleteListingImageFiles(imagePath, uploadsDir) {
  const imagePaths = new Set([
    imagePath,
    getThumbnailPath(imagePath),
  ]);
  await Promise.allSettled([...imagePaths].filter(Boolean).map(storedPath => deleteStoredImage(storedPath, uploadsDir)));
}
