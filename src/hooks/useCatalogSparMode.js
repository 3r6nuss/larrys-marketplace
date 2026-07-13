import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'catalog-virtual-scrolling';
const listeners = new Set();

function getSnapshot() {
  return localStorage.getItem(STORAGE_KEY) !== 'false';
}

function subscribe(listener) {
  const handleStorage = (event) => {
    if (event.key === STORAGE_KEY) listener();
  };

  listeners.add(listener);
  window.addEventListener('storage', handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
  };
}

export function setCatalogSparMode(enabled) {
  localStorage.setItem(STORAGE_KEY, String(enabled));
  listeners.forEach(listener => listener());
}

export function useCatalogSparMode() {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
