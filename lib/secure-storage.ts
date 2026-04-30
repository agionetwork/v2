/**
 * Secure storage utilities for wallet session data.
 * Uses sessionStorage (not localStorage) since the encryption key
 * is ephemeral per page load anyway.
 */

const STORAGE_PREFIX = 'agio_';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

export const secureStorage = {
  setItem: (key: string, value: string): void => {
    const storage = getStorage();
    if (!storage) return;
    storage.setItem(STORAGE_PREFIX + key, value);
  },

  getItem: (key: string): string | null => {
    const storage = getStorage();
    if (!storage) return null;
    return storage.getItem(STORAGE_PREFIX + key);
  },

  removeItem: (key: string): void => {
    const storage = getStorage();
    if (!storage) return;
    storage.removeItem(STORAGE_PREFIX + key);
  },

  clear: (): void => {
    const storage = getStorage();
    if (!storage) return;
    const secureKeys = ['walletAddress', 'walletProvider'];
    secureKeys.forEach(key => storage.removeItem(STORAGE_PREFIX + key));
  },
};

// Rate limiting for storage operations
const storageRateLimit = new Map<string, number>();
const RATE_LIMIT_WINDOW = 1000;
const MAX_OPERATIONS_PER_WINDOW = 10;

export const rateLimitedStorage = {
  setItem: async (key: string, value: string): Promise<boolean> => {
    const keyCount = storageRateLimit.get(key) || 0;

    if (keyCount > MAX_OPERATIONS_PER_WINDOW) {
      return false;
    }

    storageRateLimit.set(key, keyCount + 1);
    setTimeout(() => {
      const current = storageRateLimit.get(key) || 0;
      storageRateLimit.set(key, Math.max(0, current - 1));
    }, RATE_LIMIT_WINDOW);

    secureStorage.setItem(key, value);
    return true;
  },

  getItem: async (key: string): Promise<string | null> => {
    return secureStorage.getItem(key);
  },

  removeItem: (key: string): void => {
    secureStorage.removeItem(key);
  },

  clearCorruptedData: (): void => {
    secureStorage.clear();
  },
};
