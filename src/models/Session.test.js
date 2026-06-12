import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionModel } from './Session.js';

describe('models/Session', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should have the correct schema path configurations', () => {
    const paths = SessionModel.schema.paths;

    // Check id field
    expect(paths.id.instance).toBe('String');
    expect(paths.id.options.required).toBe(true);
    expect(paths.id.options.unique).toBe(true);

    // Check shop field
    expect(paths.shop.instance).toBe('String');
    expect(paths.shop.options.required).toBe(true);
    expect(paths.shop.options.index).toBe(true);

    // Check state field
    expect(paths.state.instance).toBe('String');

    // Check isOnline field
    expect(paths.isOnline.instance).toBe('Boolean');
    expect(paths.isOnline.options.default).toBe(false);

    // Check scope field
    expect(paths.scope.instance).toBe('String');

    // Check expires field
    expect(paths.expires.instance).toBe('Date');
    expect(paths.expires.options.index.expires).toBe(0);

    // Check accessToken field
    expect(paths.accessToken.instance).toBe('String');

    // Check onlineAccessInfo field
    expect(paths.onlineAccessInfo.instance).toBe('Mixed');
  });

  it('should enable timestamps on the schema', () => {
    expect(SessionModel.schema.options.timestamps).toBe(true);
  });

  it('should encrypt and decrypt accessToken transparently using ENCRYPTION_KEY', () => {
    process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2'; // 64 hex chars

    const rawToken = 'shp_access_token_abc123';
    const session = new SessionModel({
      id: 'session_123',
      shop: 'test-shop.myshopify.com',
      accessToken: rawToken
    });

    // Check that the raw stored value (without getters) is encrypted
    const docWithoutGetters = session.toObject({ getters: false });
    expect(docWithoutGetters.accessToken).not.toBe(rawToken);
    expect(docWithoutGetters.accessToken).toContain(':'); // should match iv:tag:enc format

    // Check that reading the property returns the decrypted raw token
    expect(session.accessToken).toBe(rawToken);
  });

  it('should throw an error during save/read if ENCRYPTION_KEY is missing or invalid size', () => {
    delete process.env.ENCRYPTION_KEY;

    const setter = SessionModel.schema.paths.accessToken.setters[0];
    const getter = SessionModel.schema.paths.accessToken.getters[0];

    expect(() => setter('some_token')).toThrow(/ENCRYPTION_KEY must be configured/);
    expect(() => getter('some_token')).toThrow(/ENCRYPTION_KEY must be configured/);
  });
});

