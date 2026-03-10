/**
 * IndexedDB storage implementation
 *
 * Provides persistent storage for large datasets including messages,
 * using the idb library for a Promise-based API.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { A2AMessage } from '../../types/storage';

/**
 * ZeroClawDB Schema Definition
 */
interface ZeroClawDB extends DBSchema {
  messages: {
    key: [string, number]; // Composite key: [hand_id, timestamp]
    indexes: {
      'by-hand': string;
    };
    value: A2AMessage;
  };
}

/**
 * Database name and version
 */
const DB_NAME = 'zeroclaw-db';
const DB_VERSION = 1;

/**
 * Singleton database connection
 */
let dbInstance: IDBPDatabase<ZeroClawDB> | null = null;

/**
 * Get or create the IndexedDB database connection
 * @returns Promise resolving to the database instance
 */
async function getDb(): Promise<IDBPDatabase<ZeroClawDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    dbInstance = await openDB<ZeroClawDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create messages store with composite key path
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', {
            keyPath: ['hand_id', 'timestamp']
          });
          // Create index for efficient queries by hand_id
          messageStore.createIndex('by-hand', 'hand_id');
        }
      },
      blocked() {
        console.error('[IndexedDB] Database upgrade blocked by older connection');
      },
      blocking() {
        console.error('[IndexedDB] This connection is blocking an upgrade');
      }
    });

    return dbInstance;
  } catch (error) {
    console.error('[IndexedDB] Failed to open database:', error);
    throw error;
  }
}

/**
 * IndexedDB store interface
 */
export interface IdbStore {
  /**
   * Get all messages for a specific hand
   * @param handId - The hand identifier
   * @returns Promise resolving to array of messages
   */
  getMessages(handId: string): Promise<A2AMessage[]>;

  /**
   * Add a new message to the store
   * @param message - The message to add
   * @returns Promise resolving when the message is added
   */
  addMessage(message: A2AMessage): Promise<void>;

  /**
   * Clear all messages for a specific hand
   * @param handId - The hand identifier
   * @returns Promise resolving when messages are cleared
   */
  clearHand(handId: string): Promise<void>;

  /**
   * Clear all messages from the store
   * @returns Promise resolving when all messages are cleared
   */
  clearAll(): Promise<void>;
}

/**
 * IndexedDB store implementation
 */
export const idbStore: IdbStore = {
  /**
   * Get all messages for a specific hand
   */
  async getMessages(handId: string): Promise<A2AMessage[]> {
    try {
      const db = await getDb();
      const tx = db.transaction('messages', 'readonly');
      const index = tx.store.index('by-hand');

      const messages = await index.getAll(handId);
      await tx.done;

      // Sort by timestamp ascending
      return messages.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error(`[IndexedDB] Failed to get messages for hand "${handId}":`, error);
      return [];
    }
  },

  /**
   * Add a new message to the store
   */
  async addMessage(message: A2AMessage): Promise<void> {
    try {
      const db = await getDb();
      await db.put('messages', message);
    } catch (error) {
      console.error('[IndexedDB] Failed to add message:', error);
      throw error;
    }
  },

  /**
   * Clear all messages for a specific hand
   */
  async clearHand(handId: string): Promise<void> {
    try {
      const db = await getDb();
      const tx = db.transaction('messages', 'readwrite');
      const index = tx.store.index('by-hand');

      // Get all keys for this hand
      const keys = await index.getAllKeys(handId);

      // Delete each message
      await Promise.all(keys.map(key => tx.store.delete(key)));

      await tx.done;
    } catch (error) {
      console.error(`[IndexedDB] Failed to clear messages for hand "${handId}":`, error);
      throw error;
    }
  },

  /**
   * Clear all messages from the store
   */
  async clearAll(): Promise<void> {
    try {
      const db = await getDb();
      await db.clear('messages');
    } catch (error) {
      console.error('[IndexedDB] Failed to clear all messages:', error);
      throw error;
    }
  }
};

/**
 * Close the database connection
 * Useful for cleanup or testing
 */
export async function closeDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Delete the entire database
 * Useful for reset or testing
 */
export async function deleteDb(): Promise<void> {
  try {
    await closeDb();
    await indexedDB.deleteDatabase(DB_NAME);
  } catch (error) {
    console.error('[IndexedDB] Failed to delete database:', error);
    throw error;
  }
}
