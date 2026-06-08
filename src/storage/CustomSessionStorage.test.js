import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { Session } from '@shopify/shopify-api';
import { CustomSessionStorage } from './CustomSessionStorage.js';
import { SessionModel } from '../models/Session.js';

// Mock the model with a simulated in-memory store
vi.mock('../models/Session.js', () => {
  let store = new Map();
  return {
    SessionModel: {
      findOneAndUpdate: vi.fn(async (query, data) => {
        store.set(query.id, { ...data });
        return store.get(query.id);
      }),
      findOne: vi.fn(async (query) => {
        return store.get(query.id) || null;
      }),
      deleteOne: vi.fn(async (query) => {
        const deleted = store.has(query.id);
        store.delete(query.id);
        return { deletedCount: deleted ? 1 : 0 };
      }),
      __clearMockDb: () => {
        store.clear();
      }
    }
  };
});

describe('storage/CustomSessionStorage', () => {
  let storage;

  beforeEach(() => {
    storage = new CustomSessionStorage();
    SessionModel.__clearMockDb();
    vi.clearAllMocks();
  });

  // Feature: shopify-express-mongoose-boilerplate, Property 3: Session storage round-trip
  it('Property 3: Session storage round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1 }),
          shop: fc.string({ minLength: 1 }),
          state: fc.string(),
          isOnline: fc.boolean(),
          scope: fc.string(),
          expires: fc.option(fc.date()),
          accessToken: fc.string(),
          onlineAccessInfo: fc.option(fc.dictionary(fc.string(), fc.anything()))
        }),
        async (rawSession) => {
          // Normalize optional undefined fields
          const session = new Session({
            id: rawSession.id,
            shop: rawSession.shop,
            state: rawSession.state,
            isOnline: rawSession.isOnline,
            scope: rawSession.scope,
            expires: rawSession.expires || undefined,
            accessToken: rawSession.accessToken,
            onlineAccessInfo: rawSession.onlineAccessInfo || undefined
          });

          // Store the session
          const stored = await storage.storeSession(session);
          expect(stored).toBe(true);

          // Load the session
          const loaded = await storage.loadSession(session.id);
          expect(loaded).toBeDefined();

          // Verify all fields are equivalent
          expect(loaded.id).toBe(session.id);
          expect(loaded.shop).toBe(session.shop);
          expect(loaded.state).toBe(session.state);
          expect(loaded.isOnline).toBe(session.isOnline);
          expect(loaded.scope).toBe(session.scope);
          expect(loaded.accessToken).toBe(session.accessToken);
          expect(loaded.onlineAccessInfo).toEqual(session.onlineAccessInfo);

          // Match dates
          if (session.expires) {
            expect(loaded.expires).toBeInstanceOf(Date);
            expect(loaded.expires.getTime()).toBe(session.expires.getTime());
          } else {
            expect(loaded.expires).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: shopify-express-mongoose-boilerplate, Property 4: Delete removes session permanently
  it('Property 4: Delete removes session permanently', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string({ minLength: 1 }),
          shop: fc.string({ minLength: 1 }),
          state: fc.string(),
          isOnline: fc.boolean(),
          scope: fc.string(),
          expires: fc.option(fc.date()),
          accessToken: fc.string(),
          onlineAccessInfo: fc.option(fc.dictionary(fc.string(), fc.anything()))
        }),
        async (rawSession) => {
          const session = new Session({
            id: rawSession.id,
            shop: rawSession.shop,
            state: rawSession.state,
            isOnline: rawSession.isOnline,
            scope: rawSession.scope,
            expires: rawSession.expires || undefined,
            accessToken: rawSession.accessToken,
            onlineAccessInfo: rawSession.onlineAccessInfo || undefined
          });

          // Store it
          await storage.storeSession(session);

          // Delete it
          const deleted = await storage.deleteSession(session.id);
          expect(deleted).toBe(true);

          // Load and assert undefined
          const loaded = await storage.loadSession(session.id);
          expect(loaded).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Unit tests for error propagation
  it('should propagate MongoDB errors when storing a session fails', async () => {
    SessionModel.findOneAndUpdate.mockRejectedValueOnce(new Error('DB connection lost'));

    const session = new Session({
      id: 'test-session',
      shop: 'test.myshopify.com',
      state: 'state',
      isOnline: false,
      scope: 'read_products',
      accessToken: 'token'
    });

    await expect(storage.storeSession(session)).rejects.toThrow('DB connection lost');
  });

  it('should propagate MongoDB errors when loading a session fails', async () => {
    SessionModel.findOne.mockRejectedValueOnce(new Error('Query timeout'));

    await expect(storage.loadSession('some-id')).rejects.toThrow('Query timeout');
  });

  it('should propagate MongoDB errors when deleting a session fails', async () => {
    SessionModel.deleteOne.mockRejectedValueOnce(new Error('Write concern error'));

    await expect(storage.deleteSession('some-id')).rejects.toThrow('Write concern error');
  });
});
