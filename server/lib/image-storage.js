import path from 'path';
import { unlink, writeFile } from 'fs/promises';

let awsModulePromise;
let s3ClientPromise;

function getStorageDriver() {
  return (process.env.IMAGE_STORAGE || 'local').trim().toLowerCase();
}

function getPublicBaseUrl() {
  return (process.env.S3_PUBLIC_URL || '').replace(/\/+$/, '');
}

function getObjectKey(filename) {
  const prefix = (process.env.S3_PREFIX || '').replace(/^\/+|\/+$/g, '');
  return prefix ? `${prefix}/${filename}` : filename;
}

function assertSafeFilename(filename) {
  if (!filename || filename !== path.basename(filename) || filename.includes('\\')) {
    throw new Error('Invalid image filename.');
  }
}

function getImageContentType(filename) {
  return {
    '.avif': 'image/avif',
    '.gif': 'image/gif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  }[path.extname(filename).toLowerCase()] || 'application/octet-stream';
}

export function validateImageStorageConfig() {
  const driver = getStorageDriver();
  if (!['local', 's3'].includes(driver)) {
    throw new Error(`Unsupported IMAGE_STORAGE driver: ${driver}`);
  }
  if (driver === 'local') return;

  const required = ['S3_BUCKET', 'S3_PUBLIC_URL'];
  const missing = required.filter(name => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing object storage configuration: ${missing.join(', ')}`);
  }
  if (Boolean(process.env.S3_ACCESS_KEY_ID) !== Boolean(process.env.S3_SECRET_ACCESS_KEY)) {
    throw new Error('S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be configured together.');
  }

  const publicUrl = new URL(getPublicBaseUrl());
  if (!['http:', 'https:'].includes(publicUrl.protocol)) {
    throw new Error('S3_PUBLIC_URL must be an HTTP(S) URL.');
  }
}

export function getImageStorageDriver() {
  validateImageStorageConfig();
  return getStorageDriver();
}

export function getStoredImagePath(filename) {
  assertSafeFilename(filename);
  if (getImageStorageDriver() === 'local') return `/uploads/${filename}`;
  return `${getPublicBaseUrl()}/${getObjectKey(filename)}`;
}

async function getAwsModule() {
  awsModulePromise ||= import('@aws-sdk/client-s3');
  return awsModulePromise;
}

async function getS3Client() {
  if (!s3ClientPromise) {
    s3ClientPromise = getAwsModule().then(({ S3Client }) => {
      const credentials = process.env.S3_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined;
      return new S3Client({
        region: process.env.S3_REGION || 'auto',
        ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
        ...(credentials ? { credentials } : {}),
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      });
    });
  }
  return s3ClientPromise;
}

export async function storeImage(filename, buffer, uploadsDir) {
  assertSafeFilename(filename);
  const storedPath = getStoredImagePath(filename);

  if (getStorageDriver() === 'local') {
    await writeFile(path.join(uploadsDir, filename), buffer);
    return storedPath;
  }

  const [{ PutObjectCommand }, client] = await Promise.all([getAwsModule(), getS3Client()]);
  await client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: getObjectKey(filename),
    Body: buffer,
    ContentType: getImageContentType(filename),
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return storedPath;
}

export async function deleteStoredImage(imagePath, uploadsDir) {
  if (!imagePath) return;

  if (imagePath.startsWith('/uploads/')) {
    const filename = path.basename(imagePath);
    await unlink(path.join(uploadsDir, filename));
    return;
  }

  if (getImageStorageDriver() !== 's3') return;
  const publicPrefix = `${getPublicBaseUrl()}/`;
  if (!imagePath.startsWith(publicPrefix)) return;

  const key = imagePath.slice(publicPrefix.length);
  const configuredPrefix = (process.env.S3_PREFIX || '').replace(/^\/+|\/+$/g, '');
  if (configuredPrefix && !key.startsWith(`${configuredPrefix}/`)) return;

  const [{ DeleteObjectCommand }, client] = await Promise.all([getAwsModule(), getS3Client()]);
  await client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
}