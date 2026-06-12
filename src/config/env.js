import "dotenv/config";

const REQUIRED_VARS = [
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "SHOPIFY_SCOPES",
  "HOST",
  "PORT",
  "MONGODB_URI",
  "APP_SLUG",
  "ENCRYPTION_KEY",
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
 *   appSlug: string,
 *   encryptionKey: string
 * }>} Frozen configuration object
 * @throws {Error} If any required variables are missing, if MONGODB_URI is malformed,
 *                 or if ENCRYPTION_KEY is not exactly 32 characters long.
 */
export function validateAndLoadEnv() {
  const missing = [];

  for (const varName of REQUIRED_VARS) {
    const value = process.env[varName];
    if (value === undefined || (varName !== "MONGODB_URI" && value === "")) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }

  const mongodbUri = process.env.MONGODB_URI;
  if (
    !mongodbUri.startsWith("mongodb://") &&
    !mongodbUri.startsWith("mongodb+srv://")
  ) {
    throw new Error(
      "MONGODB_URI is malformed. It must start with mongodb:// or mongodb+srv://",
    );
  }

  const host = process.env.HOST;

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
    throw new Error(
      "ENCRYPTION_KEY is malformed. It must be a 64-character hex string (representing a 32-byte key).",
    );
  }

  const config = {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: process.env.SHOPIFY_SCOPES,
    host: host,
    port: process.env.PORT,
    mongodbUri: mongodbUri,
    appSlug: process.env.APP_SLUG,
    encryptionKey: encryptionKey,
  };

  return Object.freeze(config);
}

