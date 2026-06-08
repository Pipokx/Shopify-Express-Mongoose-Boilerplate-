import { shopifyApi, ApiVersion } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node';

let shopifyInstance = null;

/**
 * Initializes the `@shopify/shopify-api` SDK singleton.
 * @param {object} config - The environment configuration object.
 * @param {object} sessionStorage - CustomSessionStorage instance.
 * @returns {object} The initialized Shopify SDK instance.
 * @throws {Error} If required SDK parameters are missing.
 */
export function initShopify(config, sessionStorage) {
  if (
    !config ||
    !config.apiKey ||
    !config.apiSecretKey ||
    !config.scopes ||
    !config.host
  ) {
    throw new Error('Missing required configuration parameters for Shopify SDK initialization');
  }

  // Clean host name: strip protocol and trailing slashes
  const hostName = config.host.replace(/^https?:\/\//, '').replace(/\/$/, '');

  // Parse scopes: comma-separated list of granted OAuth scopes
  const scopes = config.scopes.split(',').map(s => s.trim()).filter(Boolean);

  shopifyInstance = shopifyApi({
    apiKey: config.apiKey,
    apiSecretKey: config.apiSecretKey,
    scopes,
    hostName,
    isEmbeddedApp: true,
    apiVersion: ApiVersion.April26,
    customSessionStorage: sessionStorage
  });

  return shopifyInstance;
}

/**
 * Gets the active Shopify SDK instance.
 * @returns {object} The active Shopify SDK instance.
 * @throws {Error} If the SDK has not been initialized yet.
 */
export function getShopify() {
  if (!shopifyInstance) {
    throw new Error('Shopify SDK has not been initialized. Call initShopify first.');
  }
  return shopifyInstance;
}
