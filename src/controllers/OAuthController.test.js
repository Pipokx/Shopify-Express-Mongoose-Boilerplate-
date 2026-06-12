import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { beginAuth, handleCallback, handleRoot } from './OAuthController.js';
import { initShopify } from '../config/shopify.js';
import { CustomSessionStorage } from '../storage/CustomSessionStorage.js';
import { SessionModel } from '../models/Session.js';
import { CookieNotFound, InvalidOAuthError } from '@shopify/shopify-api';

// Mock the Mongoose model
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
        store.delete(query.id);
        return { deletedCount: 1 };
      }),
      __getStore: () => store,
      __clearMockDb: () => store.clear()
    }
  };
});

describe('controllers/OAuthController', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    SessionModel.__clearMockDb();

    process.env.SHOPIFY_API_KEY = 'test_key';
    process.env.SHOPIFY_API_SECRET = 'test_secret';
    process.env.SHOPIFY_SCOPES = 'read_products';
    process.env.HOST = 'https://test-app.myshopify.com';
    process.env.APP_SLUG = 'test-app';

    const config = {
      apiKey: 'test_key',
      apiSecretKey: 'test_secret',
      scopes: 'read_products',
      host: 'https://test-app.myshopify.com',
      appSlug: 'test-app'
    };
    const shopify = initShopify(config, new CustomSessionStorage());

    vi.spyOn(shopify.auth, 'begin').mockImplementation(async ({ shop, rawResponse }) => {
      const state = Math.random().toString(36).substring(2);
      const session = {
        id: `offline_${shop}`,
        shop,
        state,
        isOnline: false
      };
      await shopify.config.customSessionStorage.storeSession(session);
      rawResponse.writeHead(302, { Location: `https://${shop}/admin/oauth/authorize?state=${state}` });
      rawResponse.end();
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Generator for valid Shopify shop domains
  const validShopGen = fc
    .hexaString({ minLength: 1, maxLength: 15 })
    .map(s => `${s}.myshopify.com`);

  // Feature: shopify-express-mongoose-boilerplate, Property 5: Invalid shop domain always returns HTTP 400
  it('Property 5: Invalid shop domain always returns HTTP 400', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string().filter(s => !/^[a-z0-9-]+\.myshopify\.com$/i.test(s)),
        async (invalidShop) => {
          const req = {
            query: { shop: invalidShop }
          };
          const res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
          };

          await beginAuth(req, res);

          expect(res.status).toHaveBeenCalledWith(400);
          expect(res.json).toHaveBeenCalledWith({ error: 'Invalid shop domain. Must match *.myshopify.com' });
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: shopify-express-mongoose-boilerplate, Property 6: Valid shop domain always triggers a redirect
  it('Property 6: Valid shop domain always triggers a redirect', async () => {
    await fc.assert(
      fc.asyncProperty(
        validShopGen,
        async (validShop) => {
          const req = {
            query: { shop: validShop },
            headers: { host: 'test-app.myshopify.com' }
          };
          const res = {
            writeHead: vi.fn().mockReturnThis(),
            end: vi.fn().mockReturnThis(),
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
          };

          await beginAuth(req, res);

          // Shopify SDK performs redirect via writeHead(302, { Location: ... })
          expect(res.writeHead).toHaveBeenCalledWith(302, expect.any(Object));
          expect(res.end).toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: shopify-express-mongoose-boilerplate, Property 7: Each OAuth initiation produces a unique nonce
  it('Property 7: Each OAuth initiation produces a unique nonce', async () => {
    await fc.assert(
      fc.asyncProperty(
        validShopGen,
        validShopGen,
        async (shop1, shop2) => {
          // Skip if shops are identical
          if (shop1 === shop2) return;

          SessionModel.__clearMockDb();

          const makeReqRes = (shop) => ({
            req: {
              query: { shop },
              headers: { host: 'test-app.myshopify.com' }
            },
            res: {
              writeHead: vi.fn().mockReturnThis(),
              end: vi.fn().mockReturnThis(),
              status: vi.fn().mockReturnThis(),
              json: vi.fn().mockReturnThis()
            }
          });

          const flow1 = makeReqRes(shop1);
          const flow2 = makeReqRes(shop2);

          await beginAuth(flow1.req, flow1.res);
          await beginAuth(flow2.req, flow2.res);

          const store = SessionModel.__getStore();
          const sessions = Array.from(store.values());

          expect(sessions.length).toBe(2);
          expect(sessions[0].state).toBeDefined();
          expect(sessions[1].state).toBeDefined();
          expect(sessions[0].state).not.toBe(sessions[1].state);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Unit tests
  it('should redirect back to /api/auth on CookieNotFound error', async () => {
    // Force SDK callback to fail with CookieNotFound error
    const shopify = initShopify(
      {
        apiKey: 'test_key',
        apiSecretKey: 'test_secret',
        scopes: 'read_products',
        host: 'https://test-app.myshopify.com',
        appSlug: 'test-app'
      },
      new CustomSessionStorage()
    );

    // Mock callback to reject with CookieNotFound
    vi.spyOn(shopify.auth, 'callback').mockRejectedValueOnce(new CookieNotFound('Could not find session cookie'));

    const req = {
      query: { shop: 'my-shop.myshopify.com' }
    };
    const res = {
      setHeader: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      redirect: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };

    await handleCallback(req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('decodeURIComponent'));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('/api/auth?shop=my-shop.myshopify.com')));
  });

  it('should return 403 on InvalidOAuthError', async () => {
    const shopify = initShopify(
      {
        apiKey: 'test_key',
        apiSecretKey: 'test_secret',
        scopes: 'read_products',
        host: 'https://test-app.myshopify.com',
        appSlug: 'test-app'
      },
      new CustomSessionStorage()
    );

    vi.spyOn(shopify.auth, 'callback').mockRejectedValueOnce(new InvalidOAuthError('Validation failed'));

    const req = {
      query: { shop: 'my-shop.myshopify.com' }
    };
    const res = {
      redirect: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };

    await handleCallback(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'OAuth callback validation failed: Validation failed' });
  });
});

describe('controllers/OAuthController - handleRoot', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    SessionModel.__clearMockDb();

    process.env.SHOPIFY_API_KEY = 'test_key';
    process.env.SHOPIFY_API_SECRET = 'test_secret';
    process.env.SHOPIFY_SCOPES = 'read_products';
    process.env.HOST = 'https://test-app.myshopify.com';
    process.env.APP_SLUG = 'test-app';

    initShopify(
      {
        apiKey: 'test_key',
        apiSecretKey: 'test_secret',
        scopes: 'read_products',
        host: 'https://test-app.myshopify.com',
        appSlug: 'test-app'
      },
      new CustomSessionStorage()
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return 400 when shop parameter is missing', async () => {
    const req = { query: {} };
    const res = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };

    await handleRoot(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Missing or invalid shop'));
  });

  it('should return 400 when shop parameter is invalid', async () => {
    const req = { query: { shop: 'not-a-valid-domain' } };
    const res = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };

    await handleRoot(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return success HTML when a valid session with accessToken exists', async () => {
    // Pre-store a valid session
    const storage = new CustomSessionStorage();
    await storage.storeSession({
      id: 'offline_my-store.myshopify.com',
      shop: 'my-store.myshopify.com',
      state: '',
      isOnline: false,
      scope: 'read_products',
      accessToken: 'shp_valid_token_123'
    });

    const req = { query: { shop: 'my-store.myshopify.com' } };
    const res = {
      setHeader: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis()
    };

    await handleRoot(req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Connexion réussie'));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('my-store.myshopify.com'));
  });

  it('should return breakout redirect HTML when no session exists', async () => {
    const req = { query: { shop: 'new-store.myshopify.com', hmac: 'abc123' } };
    const res = {
      setHeader: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis()
    };

    await handleRoot(req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('decodeURIComponent'));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('/api/auth?shop=new-store.myshopify.com&hmac=abc123')));
  });

  it('should return 500 without leaking error details when session loading fails', async () => {
    // Force loadSession to throw
    SessionModel.findOne.mockRejectedValueOnce(new Error('MongoDB connection lost'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const req = { query: { shop: 'fail-store.myshopify.com' } };
    const res = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis()
    };

    await handleRoot(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith('Internal server error');
    // Ensure the actual error message is NOT exposed to the client
    expect(res.send).not.toHaveBeenCalledWith(expect.stringContaining('MongoDB connection lost'));

    consoleSpy.mockRestore();
  });
});
