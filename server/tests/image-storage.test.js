import test from 'node:test';
import assert from 'node:assert/strict';
import { getStoredImagePath, validateImageStorageConfig } from '../lib/image-storage.js';

const STORAGE_ENV_NAMES = [
  'IMAGE_STORAGE',
  'S3_BUCKET',
  'S3_PUBLIC_URL',
  'S3_PREFIX',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
];

async function withStorageEnv(values, callback) {
  const original = Object.fromEntries(STORAGE_ENV_NAMES.map(name => [name, process.env[name]]));
  try {
    for (const name of STORAGE_ENV_NAMES) delete process.env[name];
    Object.assign(process.env, values);
    await callback();
  } finally {
    for (const name of STORAGE_ENV_NAMES) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
}

test('local image storage keeps the existing uploads URL contract', async () => {
  await withStorageEnv({}, () => {
    assert.equal(getStoredImagePath('listing-1-full.webp'), '/uploads/listing-1-full.webp');
  });
});

test('S3 image storage builds a public URL with an optional prefix', async () => {
  await withStorageEnv({
    IMAGE_STORAGE: 's3',
    S3_BUCKET: 'larrys-images',
    S3_PUBLIC_URL: 'https://media.example.test/',
    S3_PREFIX: '/production/',
  }, () => {
    assert.equal(
      getStoredImagePath('listing-1-full.webp'),
      'https://media.example.test/production/listing-1-full.webp',
    );
  });
});

test('S3 image storage rejects incomplete configuration', async () => {
  await withStorageEnv({ IMAGE_STORAGE: 's3', S3_BUCKET: 'larrys-images' }, () => {
    assert.throws(validateImageStorageConfig, /S3_PUBLIC_URL/);
  });
});