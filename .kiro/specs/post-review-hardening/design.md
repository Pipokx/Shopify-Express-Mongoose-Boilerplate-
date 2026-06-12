# Design Document: Post-Review Hardening

## Overview

This design covers seven targeted hardening improvements for the Shopify Express Mongoose Boilerplate identified during code review. The changes strengthen error handling reliability, protect secrets at rest, enable webhook verification, automate expired session cleanup, defend against abuse, provide developer tooling for protected routes, and document compliance requirements.

## Architecture

Changes are isolated to specific modules and do not alter the overall application architecture (Express app factory → routes → controllers → storage → MongoDB). Each improvement is a localized enhancement within the existing module boundaries.

```
┌─────────────────────────────────────────────────────────────┐
│                         server.js                            │
│  validateAndLoadEnv() ─► connectDB() ─► initShopify()       │
│                                           ─► createApp()    │
└────────────────────────────────────┬────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────┐
│                     src/app.js (App_Factory)                  │
│  express.json({ verify }) ─► rateLimiter ─► routes          │
└────────────────────────────────────┬────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────┐
│                    src/routes/auth.js                         │
│  GET /         ─► handleRoot                                 │
│  GET /api/auth ─► validateHmac ─► beginAuth                  │
│  GET /api/auth/callback ─► handleCallback                    │
└────────────────────────────────────┬────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────┐
│              src/controllers/OAuthController.js               │
│  instanceof CookieNotFound / InvalidOAuthError branching     │
└────────────────────────────────────┬────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────┐
│            src/storage/CustomSessionStorage.js                │
│  encrypt(accessToken) on store ─► decrypt on load            │
└────────────────────────────────────┬────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────┐
│                 src/models/Session.js                         │
│  TTL index on expires field (expireAfterSeconds: 0)          │
└─────────────────────────────────────────────────────────────┘

Unmounted (available for extension):
  src/middleware/validateSessionToken.js
```

## Components and Interfaces

### 1. OAuthController — instanceof Error Detection

**File:** `src/controllers/OAuthController.js`

Replace `error.constructor.name` string comparisons with proper `instanceof` checks.

```javascript
import { CookieNotFound, InvalidOAuthError } from '@shopify/shopify-api';

// In handleCallback catch block:
catch (error) {
  if (error instanceof CookieNotFound) {
    // Cookie-not-found recovery: iframe breakout redirect to /api/auth
    const shop = req.query.shop;
    if (shop && /^[a-z0-9-]+\.myshopify\.com$/i.test(shop)) {
      const queryString = new URLSearchParams(req.query).toString();
      const redirectUrl = `/api/auth?${queryString}`;
      const safeUrl = encodeURIComponent(redirectUrl);
      res.setHeader('Content-Type', 'text/html');
      return res.send(/* iframe breakout HTML */);
    }
  }

  if (error instanceof InvalidOAuthError) {
    return res.status(403).json({ error: `OAuth callback validation failed: ${error.message}` });
  }

  // Generic fallback
  return res.status(500).json({ error: `Token exchange failed: ${error.message}` });
}
```

**Rationale:** `instanceof` is reliable across module boundaries and survives minification/bundling, unlike `constructor.name` string checks which can break with terser or different module instances.

---

### 2. CustomSessionStorage — AES-256-GCM Encryption

**File:** `src/storage/CustomSessionStorage.js`

#### Encryption Module

A helper module (`src/storage/encryption.js`) encapsulates all crypto operations:

```javascript
import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;       // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * @param {string} plaintext - The value to encrypt.
 * @param {string} hexKey - 64-character hex-encoded 256-bit key.
 * @returns {string} Base64-encoded string containing IV + authTag + ciphertext.
 */
export function encrypt(plaintext, hexKey) {
  const key = Buffer.from(hexKey, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  // Store as: IV (12 bytes) + authTag (16 bytes) + ciphertext (variable)
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypts a base64-encoded ciphertext produced by encrypt().
 * @param {string} encoded - Base64-encoded IV + authTag + ciphertext.
 * @param {string} hexKey - 64-character hex-encoded 256-bit key.
 * @returns {string} The decrypted plaintext.
 */
export function decrypt(encoded, hexKey) {
  const key = Buffer.from(hexKey, 'hex');
  const combined = Buffer.from(encoded, 'base64');

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);
  return decrypted.toString('utf8');
}
```

#### Storage Integration

```javascript
import { encrypt, decrypt } from './encryption.js';

export class CustomSessionStorage {
  async storeSession(session) {
    const encryptionKey = process.env.ENCRYPTION_KEY;

    const sessionData = {
      id: session.id,
      shop: session.shop,
      state: session.state,
      isOnline: session.isOnline,
      scope: session.scope,
      expires: session.expires ? new Date(session.expires) : undefined,
      accessToken: session.accessToken != null
        ? encrypt(session.accessToken, encryptionKey)
        : session.accessToken,
      onlineAccessInfo: session.onlineAccessInfo
    };

    await SessionModel.findOneAndUpdate(
      { id: session.id },
      sessionData,
      { upsert: true, new: true }
    );
    return true;
  }

  async loadSession(id) {
    const doc = await SessionModel.findOne({ id });
    if (!doc) return undefined;

    const encryptionKey = process.env.ENCRYPTION_KEY;
    const accessToken = doc.accessToken != null
      ? decrypt(doc.accessToken, encryptionKey)
      : doc.accessToken;

    return new Session({
      id: doc.id,
      shop: doc.shop,
      state: doc.state,
      isOnline: doc.isOnline,
      scope: doc.scope,
      expires: doc.expires ? new Date(doc.expires) : undefined,
      accessToken,
      onlineAccessInfo: doc.onlineAccessInfo
    });
  }
}
```

**Data format:** The `accessToken` field in MongoDB stores a base64 string of the shape `IV (12B) || authTag (16B) || ciphertext (variable)`.

---

### 3. Raw Body Capture

**File:** `src/app.js`

```javascript
app.use(express.json({
  verify: (req, res, buf, encoding) => {
    if (buf && buf.length > 0) {
      req.rawBody = buf;
    }
  }
}));
```

The `verify` callback fires before JSON parsing. If the buffer has content, it is attached as `req.rawBody`. Empty bodies (length 0) result in `req.rawBody` remaining `undefined`.

---

### 4. TTL Index on Session Model

**File:** `src/models/Session.js`

```javascript
const SessionSchema = new mongoose.Schema({
  // ... existing fields ...
  expires: {
    type: Date,
    index: { expires: 0 }  // TTL index: delete when current time >= expires
  },
  // ...
});
```

Alternatively, using `schema.index()`:

```javascript
SessionSchema.index({ expires: 1 }, { expireAfterSeconds: 0 });
```

**Behavior:** MongoDB's TTL monitor (runs every ~60s) removes documents whose `expires` field is at or past the current time. Setting `expireAfterSeconds: 0` means "delete at the exact time specified in the field."

---

### 5. Rate Limiting

**File:** `src/app.js`

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000,  // 60-second window
  max: 30,              // 30 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// Apply to specific routes before mounting authRouter
app.use('/', limiter);
app.use('/api/auth', limiter);
```

**Note:** `express-rate-limit` must be added to `dependencies` in `package.json`.

---

### 6. ValidateSessionToken Middleware

**File:** `src/middleware/validateSessionToken.js`

```javascript
import { getShopify } from '../config/shopify.js';

/**
 * Express middleware that verifies a Shopify App Bridge session token (JWT).
 *
 * This middleware extracts the Bearer token from the Authorization header,
 * verifies it using the Shopify API library, and attaches the decoded
 * session payload to `req.sessionToken`.
 *
 * Usage:
 *   import { validateSessionToken } from './middleware/validateSessionToken.js';
 *   router.get('/api/protected', validateSessionToken, (req, res) => {
 *     // req.sessionToken contains the decoded JWT payload
 *   });
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export async function validateSessionToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix
  const shopify = getShopify();

  try {
    const payload = await shopify.session.decodeSessionToken(token);
    req.sessionToken = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid session token' });
  }
}
```

This middleware is **not** mounted on any route by default. Developers mount it explicitly on routes they wish to protect.

---

### 7. GDPR Webhook Documentation

**File:** `README.md` (new section)

A markdown section documenting:
- `customers/data_request` — Shopify requests all stored customer data
- `customers/redact` — Shopify requests deletion of a customer's personal data
- `shop/redact` — Shopify requests deletion of all shop data after app uninstall

The section notes these are mandatory for App Store submission and links to Shopify's GDPR documentation.

---

## Data Models

### Session Document (MongoDB)

```javascript
{
  id: String,            // Shopify session ID (unique)
  shop: String,          // Shop domain (indexed)
  state: String,         // OAuth state nonce
  isOnline: Boolean,     // Online vs offline token
  scope: String,         // Granted scopes
  expires: Date,         // TTL-indexed expiry date (expireAfterSeconds: 0)
  accessToken: String,   // AES-256-GCM encrypted (base64: IV + authTag + ciphertext)
  onlineAccessInfo: Mixed,
  createdAt: Date,       // Mongoose timestamps
  updatedAt: Date        // Mongoose timestamps
}
```

### Encrypted AccessToken Wire Format

```
┌──────────┬──────────────┬─────────────────┐
│  IV (12B) │ AuthTag (16B) │ Ciphertext (var) │
└──────────┴──────────────┴─────────────────┘
          ↓ base64-encoded as a single string
```

---

## Environment Variables

| Variable | Required | Format | Purpose |
|----------|----------|--------|---------|
| `ENCRYPTION_KEY` | Yes | 64 hex characters (32 bytes) | AES-256-GCM key for accessToken encryption |

Added to the existing `REQUIRED_VARS` array in `src/config/env.js`.

---

## Error Handling

| Scenario | Response |
|----------|----------|
| `CookieNotFound` during OAuth callback | Iframe breakout redirect to `/api/auth` with original query params |
| `InvalidOAuthError` during OAuth callback | HTTP 403 + JSON error message |
| Missing/invalid Authorization header (validateSessionToken) | HTTP 401 + JSON error |
| Invalid/expired JWT (validateSessionToken) | HTTP 401 + JSON error |
| Rate limit exceeded | HTTP 429 + JSON error message |
| Decryption failure (tampered ciphertext) | Error propagates to global handler → HTTP 500 |
| Missing ENCRYPTION_KEY at boot | Startup throws, `process.exit(1)` |

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `express-rate-limit` | ^7.x | Rate limiting middleware |

All other functionality uses Node.js built-in `crypto` module and existing dependencies (`@shopify/shopify-api`, `mongoose`, `express`).

---

## Testing Strategy

- **Property-based tests (Vitest + fast-check):** Validate encryption round-trips, IV uniqueness, raw body preservation, and session token verification across randomized inputs.
- **Unit tests (Vitest):** Cover specific error branches (CookieNotFound → redirect, InvalidOAuthError → 403), null accessToken passthrough, empty body handling, rate limit threshold behavior, and env validation failures.
- **Integration tests:** Verify rate limiter responds with 429 after threshold, TTL index is defined on the schema, and middleware mounting configuration.
- **Smoke tests:** Confirm imports exist, file locations are correct, and GDPR documentation is present in README.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Encryption Round-Trip Preserves AccessToken

*For any* valid accessToken string (non-null, non-undefined), encrypting with a given ENCRYPTION_KEY and then decrypting with the same key SHALL produce the original plaintext accessToken.

**Validates: Requirements 2.3, 2.4, 2.6**

### Property 2: Unique IV Per Encryption Operation

*For any* two encryption operations (even with identical plaintext and key), the initialization vectors stored in the ciphertext output SHALL be distinct.

**Validates: Requirements 2.5**

### Property 3: Raw Body Preservation

*For any* valid JSON string sent as a request body, the `req.rawBody` Buffer SHALL contain bytes identical to the original request payload.

**Validates: Requirements 3.2**

### Property 4: Valid Session Token Verification Succeeds

*For any* JWT signed with the correct Shopify API secret and containing valid claims (not expired, correct issuer), the validateSessionToken middleware SHALL attach the decoded payload to the request object and invoke `next()`.

**Validates: Requirements 6.2, 6.3**

### Property 5: Invalid Session Token Verification Rejects

*For any* JWT that is malformed, expired, or signed with an incorrect secret, the validateSessionToken middleware SHALL respond with HTTP 401 and SHALL NOT invoke `next()`.

**Validates: Requirements 6.4**
