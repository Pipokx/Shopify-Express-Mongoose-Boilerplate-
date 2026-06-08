const REQUIRED_VARS = [
  'SHOPIFY_API_KEY',
  'SHOPIFY_API_SECRET',
  'SHOPIFY_SCOPES',
  'HOST',
  'PORT',
  'MONGODB_URI',
  'APP_SLUG'
];

/**
 * Validates and loads required environment variables.
 * @returns {Readonly<{
 *   apiKey: string,
 *   apiSecretKey: string,
 *   scopes: string,
 *   host: string,
 *   port: string,
 *   mongodbUri: string,
 *   appSlug: string
 * }>} Frozen configuration object
 * @throws {Error} If any required variables are missing or if MONGODB_URI is malformed.
 */
export function validateAndLoadEnv() {
  const missing = [];

  for (const varName of REQUIRED_VARS) {
    const value = process.env[varName];
    // A variable is missing if it is undefined.
    // For variables other than MONGODB_URI, an empty string is also considered missing.
    // MONGODB_URI='' is considered present but malformed.
    if (value === undefined || (varName !== 'MONGODB_URI' && value === '')) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  const mongodbUri = process.env.MONGODB_URI;
  if (!mongodbUri.startsWith('mongodb://') && !mongodbUri.startsWith('mongodb+srv://')) {
    throw new Error('MONGODB_URI is malformed. It must start with mongodb:// or mongodb+srv://');
  }

  const config = {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: process.env.SHOPIFY_SCOPES,
    host: process.env.HOST,
    port: process.env.PORT,
    mongodbUri: mongodbUri,
    appSlug: process.env.APP_SLUG
  };

  return Object.freeze(config);
}
