/**
 * IndexedDB Storage Tests
 *
 * Run with: npm test -- indexed.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { idbStore, closeDb, deleteDb } from '../indexed';
import type { A2AMessage } from '../../../types/storage';

describe('IndexedDB Storage', () => {
  const testHandId = 'test-hand-1';

  beforeEach(async () => {
    // Clear all data before each test
    await idbStore.clearAll();
  });

  afterEach(async () => {
    // Clean up after tests
    await deleteDb();
  });

  describe('addMessage', () => {
    it('should add a message successfully', async () => {
      const message: A2AMessage = {
        hand_id: testHandId,
        timestamp: Date.now(),
        role: 'user',
        content: 'Test message'
      };

      await idbStore.addMessage(message);

      const messages = await idbStore.getMessages(testHandId);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual(message);
    });

    it('should add multiple messages for the same hand', async () => {
      const baseTime = Date.now();

      const message1: A2AMessage = {
        hand_id: testHandId,
        timestamp: baseTime,
        role: 'user',
        content: 'First message'
      };

      const message2: A2AMessage = {
        hand_id: testHandId,
        timestamp: baseTime + 1000,
        role: 'assistant',
        content: 'Second message'
      };

      await idbStore.addMessage(message1);
      await idbStore.addMessage(message2);

      const messages = await idbStore.getMessages(testHandId);
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('Second message');
    });
  });

  describe('getMessages', () => {
    it('should return empty array for non-existent hand', async () => {
      const messages = await idbStore.getMessages('non-existent-hand');
      expect(messages).toEqual([]);
    });

    it('should return messages in timestamp order', async () => {
      const baseTime = Date.now();

      // Add messages out of order
      await idbStore.addMessage({
        hand_id: testHandId,
        timestamp: baseTime + 2000,
        role: 'assistant',
        content: 'Third'
      });

      await idbStore.addMessage({
        hand_id: testHandId,
        timestamp: baseTime,
        role: 'user',
        content: 'First'
      });

      await idbStore.addMessage({
        hand_id: testHandId,
        timestamp: baseTime + 1000,
        role: 'user',
        content: 'Second'
      });

      const messages = await idbStore.getMessages(testHandId);
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('First');
      expect(messages[1].content).toBe('Second');
      expect(messages[2].content).toBe('Third');
    });

    it('should only return messages for the specified hand', async () => {
      const otherHandId = 'other-hand-1';

      await idbStore.addMessage({
        hand_id: testHandId,
        timestamp: Date.now(),
        role: 'user',
        content: 'Message for test hand'
      });

      await idbStore.addMessage({
        hand_id: otherHandId,
        timestamp: Date.now(),
        role: 'user',
        content: 'Message for other hand'
      });

      const testHandMessages = await idbStore.getMessages(testHandId);
      const otherHandMessages = await idbStore.getMessages(otherHandId);

      expect(testHandMessages).toHaveLength(1);
      expect(testHandMessages[0].content).toBe('Message for test hand');

      expect(otherHandMessages).toHaveLength(1);
      expect(otherHandMessages[0].content).toBe('Message for other hand');
    });
  });

  describe('clearHand', () => {
    it('should clear all messages for a specific hand', async () => {
      const otherHandId = 'other-hand-1';

      await idbStore.addMessage({
        hand_id: testHandId,
        timestamp: Date.now(),
        role: 'user',
        content: 'Message 1'
      });

      await idbStore.addMessage({
        hand_id: testHandId,
        timestamp: Date.now() + 1000,
        role: 'assistant',
        content: 'Message 2'
      });

      await idbStore.addMessage({
        hand_id: otherHandId,
        timestamp: Date.now(),
        role: 'user',
        content: 'Other message'
      });

      await idbStore.clearHand(testHandId);

      const testHandMessages = await idbStore.getMessages(testHandId);
      const otherHandMessages = await idbStore.getMessages(otherHandId);

      expect(testHandMessages).toEqual([]);
      expect(otherHandMessages).toHaveLength(1);
    });
  });

  describe('clearAll', () => {
    it('should clear all messages from all hands', async () => {
      const otherHandId = 'other-hand-1';

      await idbStore.addMessage({
        hand_id: testHandId,
        timestamp: Date.now(),
        role: 'user',
        content: 'Message 1'
      });

      await idbStore.addMessage({
        hand_id: otherHandId,
        timestamp: Date.now(),
        role: 'user',
        content: 'Message 2'
      });

      await idbStore.clearAll();

      const testHandMessages = await idbStore.getMessages(testHandId);
      const otherHandMessages = await idbStore.getMessages(otherHandId);

      expect(testHandMessages).toEqual([]);
      expect(otherHandMessages).toEqual([]);
    });
  });
});
