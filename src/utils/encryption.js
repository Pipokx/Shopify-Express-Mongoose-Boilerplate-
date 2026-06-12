import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes standard IV for GCM
const TAG_LENGTH = 16; // 16 bytes auth tag

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * @param {string} text - The plaintext string to encrypt.
 * @param {string} secretKey - The 64-character hex-encoded 32-byte encryption key.
 * @returns {string} The colon-separated payload: iv:authTag:encryptedHex
 * @throws {Error} If text is not a string or if key is invalid.
 */
export function encrypt(text, secretKey) {
  if (typeof text !== 'string') {
    throw new Error('Plaintext must be a string');
  }
  if (!secretKey || !/^[0-9a-fA-F]{64}$/.test(secretKey)) {
    throw new Error('Encryption key must be a 64-character hex string (32 bytes)');
  }

  const key = Buffer.from(secretKey, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted payload.
 * If the payload is not in the expected format (e.g. legacy plaintext), returns the input as-is.
 * @param {string} encryptedText - The encrypted payload (iv:authTag:encryptedHex) or plaintext.
 * @param {string} secretKey - The 64-character hex-encoded 32-byte encryption key.
 * @returns {string} The decrypted plaintext string.
 * @throws {Error} If decryption fails (e.g. invalid key or tampered ciphertext).
 */
export function decrypt(encryptedText, secretKey) {
  if (typeof encryptedText !== 'string') {
    return encryptedText;
  }
  if (!secretKey || !/^[0-9a-fA-F]{64}$/.test(secretKey)) {
    throw new Error('Encryption key must be a 64-character hex string (32 bytes)');
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    // If not colon-separated into 3 parts, return it as legacy plaintext.
    return encryptedText;
  }

  const [ivHex, authTagHex, encryptedHex] = parts;

  try {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    // Ensure hex sizes are correct
    if (iv.length !== IV_LENGTH || authTag.length !== TAG_LENGTH) {
      return encryptedText; // Treat as plaintext if hex parsing does not match standard sizes
    }

    const key = Buffer.from(secretKey, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // If decoding or deciphering fails, throw a descriptive error.
    throw new Error(`Decryption failed: ${error.message}`);
  }
}
