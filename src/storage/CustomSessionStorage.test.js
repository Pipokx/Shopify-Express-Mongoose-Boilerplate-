import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2'; // 64 hex chars
    storage = new CustomSessionStorage();
    SessionModel.__clearMockDb();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
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

  // Encryption integration tests
  it('should write an encrypted accessToken to the database', async () => {
    const rawToken = 'shp_access_token_123';
    const session = new Session({
      id: 'enc-test-session',
      shop: 'enc-test.myshopify.com',
      state: 'state',
      isOnline: false,
      accessToken: rawToken
    });

    await storage.storeSession(session);

    // Verify what was actually passed to the mock Mongoose model
    const mockCalls = SessionModel.findOneAndUpdate.mock.calls;
    expect(mockCalls.length).toBe(1);
    const sessionDataArg = mockCalls[0][1];
    
    expect(sessionDataArg.accessToken).toBeDefined();
    expect(sessionDataArg.accessToken).not.toBe(rawToken);
    expect(sessionDataArg.accessToken).toContain(':'); // Contains IV and authTag delimiters
  });

  it('should decrypt accessToken when loading from the database', async () => {
    const rawToken = 'shp_access_token_456';
    const session = new Session({
      id: 'dec-test-session',
      shop: 'dec-test.myshopify.com',
      state: 'state',
      isOnline: false,
      accessToken: rawToken
    });

    await storage.storeSession(session);
    const loadedSession = await storage.loadSession('dec-test-session');

    expect(loadedSession.accessToken).toBe(rawToken);
  });

  it('should leave null or undefined accessToken unchanged', async () => {
    const session = new Session({
      id: 'null-test-session',
      shop: 'null-test.myshopify.com',
      state: 'state',
      isOnline: false,
      accessToken: undefined
    });

    await storage.storeSession(session);
    
    const mockCalls = SessionModel.findOneAndUpdate.mock.calls;
    const sessionDataArg = mockCalls[0][1];
    expect(sessionDataArg.accessToken).toBeUndefined();

    const loadedSession = await storage.loadSession('null-test-session');
    expect(loadedSession.accessToken).toBeUndefined();
  });
});
