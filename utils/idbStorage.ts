// Centralized Storage Utility (Remotes Only - Cloudflare R2 CDN)
// Permanently removed browser IndexedDB/localStorage dependencies for campaign assets.

import { WardPoster } from '@/types/campaign';
export type { WardPoster };

const DB_NAME = 'WebARStorage';

/**
 * Purge any legacy IndexedDB database and stale localStorage items on client devices.
 */
export function purgeAllLocalStorageAndIndexedDB(): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.indexedDB && window.indexedDB.deleteDatabase) {
      window.indexedDB.deleteDatabase(DB_NAME);
    }
  } catch (e) {
    console.warn('IDB purge note:', e);
  }
  try {
    localStorage.removeItem('wards_config');
    localStorage.removeItem('wards');
    localStorage.removeItem('ar_assets');
    localStorage.removeItem('targets.mind');
  } catch (e) {}
}

export async function saveAssetBlob(_key: string, _blob: Blob): Promise<void> {
  // No-op: Browser IndexedDB caching disabled. All assets stream directly to/from Cloudflare R2.
  return Promise.resolve();
}

export async function getAssetBlob(_key: string): Promise<Blob | null> {
  // Remotes-only: Always return null so callers fetch live from Cloudflare R2 CDN.
  return Promise.resolve(null);
}

export async function getAssetUrl(_key: string, fallbackUrl: string): Promise<string> {
  // Remotes-only: Return fallbackUrl (which is either a CDN URL or static bundle asset).
  return Promise.resolve(fallbackUrl);
}

export async function clearAssetBlob(_key: string): Promise<void> {
  return Promise.resolve();
}

export async function clearAllCustomAssets(): Promise<void> {
  purgeAllLocalStorageAndIndexedDB();
  return Promise.resolve();
}

export async function saveWardsConfig(_wards: WardPoster[]): Promise<void> {
  // No-op: Ward configurations are written directly to Cloudflare R2 bucket as posters/wards.json.
  return Promise.resolve();
}

export async function getWardsConfig(): Promise<WardPoster[] | null> {
  // Remotes-only: Always return null so callers fetch live from Cloudflare R2 CDN.
  return Promise.resolve(null);
}
