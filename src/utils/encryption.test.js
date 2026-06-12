import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { encrypt, decrypt } from './encryption.js';

describe('utils/encryption', () => {
  const SECRET_KEY = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2'; // 64 hex chars (32 bytes)
  const OTHER_KEY = 'f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b3a4f5e6d7c8b9a0f1e2'; // different 64 hex chars

  it('should encrypt and decrypt a string successfully', () => {
    const originalText = 'shp_access_token_123456789';
    const encrypted = encrypt(originalText, SECRET_KEY);

    expect(encrypted).not.toBe(originalText);
    expect(encrypted.split(':').length).toBe(3);

    const decrypted = decrypt(encrypted, SECRET_KEY);
    expect(decrypted).toBe(originalText);
  });

  it('Property 1: Encryption Round-Trip Preserves AccessToken', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (plaintext) => {
          const encrypted = encrypt(plaintext, SECRET_KEY);
          const decrypted = decrypt(encrypted, SECRET_KEY);
          expect(decrypted).toBe(plaintext);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 2: Unique IV Per Encryption Operation', () => {
    const originalText = 'constant_plaintext';
    const N = 100;
    const ivs = new Set();

    for (let i = 0; i < N; i++) {
      const encrypted = encrypt(originalText, SECRET_KEY);
      const [iv, , ] = encrypted.split(':');
      ivs.add(iv);
    }

    expect(ivs.size).toBe(N);
  });

  it('should return legacy plaintext as-is when format is not colon-separated', () => {
    const plaintext = 'shp_legacy_token';
    const decrypted = decrypt(plaintext, SECRET_KEY);
    expect(decrypted).toBe(plaintext);
  });

  it('should throw an error during encryption if key is invalid', () => {
    expect(() => encrypt('test', 'short')).toThrow(/64-character hex/);
  });

  it('should throw an error during decryption if key is invalid', () => {
    expect(() => decrypt('iv:tag:enc', 'short')).toThrow(/64-character hex/);
  });

  it('should throw an error if decryption is attempted with the wrong key', () => {
    const originalText = 'secret_token';
    const encrypted = encrypt(originalText, SECRET_KEY);

    expect(() => decrypt(encrypted, OTHER_KEY)).toThrow(/Decryption failed/);
  });

  it('should throw an error if ciphertext is tampered with', () => {
    const originalText = 'secret_token';
    const encrypted = encrypt(originalText, SECRET_KEY);
    const [iv, tag, ciphertext] = encrypted.split(':');

    // Tamper with the ciphertext by replacing the last character
    const tamperedCiphertext = ciphertext.slice(0, -1) + (ciphertext.slice(-1) === '0' ? '1' : '0');
    const tamperedPayload = `${iv}:${tag}:${tamperedCiphertext}`;

    expect(() => decrypt(tamperedPayload, SECRET_KEY)).toThrow(/Decryption failed/);
  });
});
