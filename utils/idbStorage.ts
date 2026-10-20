// IndexedDB utility for persistent client-side storage of AR targets, markers, and campaign videos
const DB_NAME = 'WebARStorage';
const STORE_NAME = 'ar_assets';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveAssetBlob(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(blob, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn(`Failed to store asset "${key}" in IndexedDB:`, e);
  }
}

export async function getAssetBlob(key: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn(`Failed to read asset "${key}" from IndexedDB:`, e);
    return null;
  }
}

export async function getAssetUrl(key: string, fallbackUrl: string): Promise<string> {
  try {
    const blob = await getAssetBlob(key);
    if (blob) {
      return URL.createObjectURL(blob);
    }
  } catch (e) {
    console.warn(`Failed to load object URL for "${key}":`, e);
  }
  return fallbackUrl;
}
