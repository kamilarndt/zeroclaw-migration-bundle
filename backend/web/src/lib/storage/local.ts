/**
 * LocalStorage utility interface
 */
export interface LocalStore {
  /**
   * Get a value from localStorage
   * @param key - The storage key (without prefix)
   * @returns The parsed value or null if not found
   */
  get<T>(key: string): T | null;

  /**
   * Set a value in localStorage
   * @param key - The storage key (without prefix)
   * @param value - The value to store
   */
  set<T>(key: string, value: T): void;

  /**
   * Remove a value from localStorage
   * @param key - The storage key (without prefix)
   */
  remove(key: string): void;

  /**
   * Clear all zeroclaw-prefixed items from localStorage
   */
  clear(): void;
}

/**
 * LocalStorage implementation with zeroclaw_ prefix
 */
export const localStore: LocalStore = {
  get<T>(key: string): T | null {
    try {
      const prefixedKey = `zeroclaw_${key}`;
      const item = localStorage.getItem(prefixedKey);
      if (item === null) {
        return null;
      }
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`Error getting localStorage key "${key}":`, error);
      return null;
    }
  },

  set<T>(key: string, value: T): void {
    try {
      const prefixedKey = `zeroclaw_${key}`;
      const serialized = JSON.stringify(value);
      localStorage.setItem(prefixedKey, serialized);
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  },

  remove(key: string): void {
    try {
      const prefixedKey = `zeroclaw_${key}`;
      localStorage.removeItem(prefixedKey);
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error);
    }
  },

  clear(): void {
    try {
      // Remove all items with zeroclaw_ prefix
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('zeroclaw_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  },
};
