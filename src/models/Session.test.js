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

});

