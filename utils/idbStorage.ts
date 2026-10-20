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

export async function clearAssetBlob(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn(`Failed to delete asset "${key}" from IndexedDB:`, e);
  }
}

export async function clearAllCustomAssets(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Failed to clear IndexedDB assets:', e);
  }
}

export interface WardPoster {
  id: string;
  wardNumber: string;
  wardName: string;
  candidateName: string;
  markerUrl: string;
  videoUrl: string;
}

export async function saveWardsConfig(wards: WardPoster[]): Promise<void> {
  try {
    const jsonBlob = new Blob([JSON.stringify(wards)], { type: 'application/json' });
    await saveAssetBlob('wards_config.json', jsonBlob);
  } catch (e) {
    console.warn('Failed to save wards config:', e);
  }
}

export async function getWardsConfig(): Promise<WardPoster[] | null> {
  try {
    const blob = await getAssetBlob('wards_config.json');
    if (blob) {
      const text = await blob.text();
      const parsed: WardPoster[] = JSON.parse(text);
      // Re-hydrate any IndexedDB blobs into fresh object URLs for the current session
      for (const ward of parsed) {
        const markerBlob = await getAssetBlob(`ward_marker_${ward.id}.png`);
        if (markerBlob) {
          ward.markerUrl = URL.createObjectURL(markerBlob);
        }
        const videoBlob = await getAssetBlob(`ward_video_${ward.id}.mp4`);
        if (videoBlob) {
          ward.videoUrl = URL.createObjectURL(videoBlob);
        }
      }
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to read wards config:', e);
  }
  return null;
}


