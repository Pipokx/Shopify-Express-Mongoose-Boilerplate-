import { describe, it, expect, beforeEach } from 'vitest';
import { initShopify } from './shopify.js';
import { ApiVersion } from '@shopify/shopify-api';

describe('config/shopify', () => {
  let validConfig;
  let mockSessionStorage;

  beforeEach(() => {
    validConfig = {
      apiKey: 'test_api_key',
      apiSecretKey: 'test_secret_key',
      scopes: 'read_products, write_orders ',
      host: 'https://test-shop.myshopify.com/',
      appSlug: 'test-app'
    };
    mockSessionStorage = {
      storeSession: async () => true,
      loadSession: async () => undefined,
      deleteSession: async () => true
    };
  });

  it('should initialize the SDK with correct parameters and return shopify instance', () => {
    const shopify = initShopify(validConfig, mockSessionStorage);

    expect(shopify).toBeDefined();
    expect(shopify.config.apiKey).toBe('test_api_key');
    expect(shopify.config.apiSecretKey).toBe('test_secret_key');
    expect(shopify.config.isEmbeddedApp).toBe(true);
    expect(shopify.config.apiVersion).toBe(ApiVersion.April26);
    expect(shopify.config.customSessionStorage).toBe(mockSessionStorage);
  });

  it('should clean the host name correctly (removing protocol and trailing slash)', () => {
    const configs = [
      { host: 'https://my-store.myshopify.com/', expected: 'my-store.myshopify.com' },
      { host: 'http://my-store.myshopify.com', expected: 'my-store.myshopify.com' },
      { host: 'my-store.myshopify.com/', expected: 'my-store.myshopify.com' },
      { host: 'my-store.myshopify.com', expected: 'my-store.myshopify.com' }
    ];

    for (const { host, expected } of configs) {
      const shopify = initShopify({ ...validConfig, host }, mockSessionStorage);
      expect(shopify.config.hostName).toBe(expected);
    }
  });

  it('should parse scopes string into trimmed array', () => {
    const shopify = initShopify(validConfig, mockSessionStorage);
    expect(shopify.config.scopes.toArray()).toEqual(['read_products', 'write_orders']);
  });

  it('should throw an error when required configuration parameters are missing', () => {
    const invalidConfigs = [
      { apiKey: '' },
      { apiSecretKey: '' },
      { scopes: '' },
      { host: '' }
    ];

    for (const partial of invalidConfigs) {
      const badConfig = { ...validConfig, ...partial };
      expect(() => initShopify(badConfig, mockSessionStorage)).toThrow(/missing.*configuration/i);
    }
  });
});
