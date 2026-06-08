import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import nock from 'nock';
import { Session } from '@shopify/shopify-api';
import { createApp } from '../src/app.js';
import { initShopify } from '../src/config/shopify.js';
import { CustomSessionStorage } from '../src/storage/CustomSessionStorage.js';
import { SessionModel } from '../src/models/Session.js';

// Mock the Mongoose model in-memory
vi.mock('../src/models/Session.js', () => {
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

describe('OAuth Integration Flow', () => {
  const SECRET = 'test_shopify_api_secret_key_123456';
  let app;
  let sessionStorage;
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    SessionModel.__clearMockDb();
    nock.cleanAll();

    process.env.SHOPIFY_API_KEY = 'test_key';
    process.env.SHOPIFY_API_SECRET = SECRET;
    process.env.SHOPIFY_SCOPES = 'read_products';
    process.env.HOST = 'https://test-app.myshopify.com';
    process.env.PORT = '3000';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/db';
    process.env.APP_SLUG = 'test-app';

    const config = {
      apiKey: 'test_key',
      apiSecretKey: SECRET,
      scopes: 'read_products',
      host: 'https://test-app.myshopify.com',
      appSlug: 'test-app'
    };

    sessionStorage = new CustomSessionStorage();
    const shopify = initShopify(config, sessionStorage);
    app = createApp(shopify);
  });

  afterEach(() => {
    process.env = originalEnv;
    nock.cleanAll();
    vi.restoreAllMocks();
  });

  // Helper to compute HMAC
  function computeHmac(params, secret) {
    const message = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return crypto.createHmac('sha256', secret).update(message).digest('hex');
  }

  it('should redirect to Shopify authorization URL on valid /api/auth request', async () => {
    const params = {
      shop: 'test-store.myshopify.com'
    };
    const hmac = computeHmac(params, SECRET);

    const response = await request(app)
      .get(`/api/auth?shop=${params.shop}&hmac=${hmac}`);

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('test-store.myshopify.com/admin/oauth/authorize');
    expect(response.headers.location).toContain('state=');
  });

  it('should successfully complete OAuth callback, save session, and redirect to app', async () => {
    // 1. Setup Nock to intercept the token exchange request made by the SDK
    nock('https://test-store.myshopify.com:443')
      .post('/admin/oauth/access_token')
      .reply(200, {
        access_token: 'shp_mock_access_token_123',
        scope: 'read_products'
      });

    // 2. Call GET /api/auth to initiate OAuth (sets state cookies in response headers)
    const authParams = { shop: 'test-store.myshopify.com' };
    const authHmac = computeHmac(authParams, SECRET);
    const authResponse = await request(app).get(`/api/auth?shop=${authParams.shop}&hmac=${authHmac}`);
    expect(authResponse.status).toBe(302);

    // Extract the state cookies from Set-Cookie header (including the signature cookie .sig)
    const setCookieHeaders = authResponse.headers['set-cookie'] || [];
    const cookieValues = setCookieHeaders
      .filter(c => c.startsWith('shopify_app_state'))
      .map(c => c.split(';')[0]);
    expect(cookieValues.length).toBe(2);

    // Extract state nonce from authorization redirect URL
    const redirectUrl = authResponse.headers.location;
    const urlObj = new URL(redirectUrl);
    const state = urlObj.searchParams.get('state');

    // 3. Call GET /api/auth/callback (pass cookies manually to satisfy cookie validations)
    const callbackParams = {
      code: 'auth_code_123',
      shop: 'test-store.myshopify.com',
      state,
      timestamp: Math.floor(Date.now() / 1000).toString()
    };
    const callbackHmac = computeHmac(callbackParams, SECRET);

    const callbackResponse = await request(app)
      .get(`/api/auth/callback?code=${callbackParams.code}&shop=${callbackParams.shop}&state=${callbackParams.state}&timestamp=${callbackParams.timestamp}&hmac=${callbackHmac}`)
      .set('Cookie', cookieValues);

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.location).toBe('https://test-store.myshopify.com/admin/apps/test-app');

    // 4. Verify session was updated in DB with access token
    const savedSession = await sessionStorage.loadSession('offline_test-store.myshopify.com');
    expect(savedSession).toBeDefined();
    expect(savedSession.accessToken).toBe('shp_mock_access_token_123');
  });
});
