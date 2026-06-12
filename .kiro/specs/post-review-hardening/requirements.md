# Requirements Document

## Introduction

Post-review security and reliability hardening for the Shopify Express Mongoose Boilerplate. This spec captures seven targeted improvements identified during code review: replacing fragile error-type detection with proper `instanceof` checks, encrypting session access tokens at rest, capturing raw request bodies for webhook verification, adding TTL indexes for expired session cleanup, rate limiting public endpoints, providing a ready-to-use App Bridge session token verification middleware, and documenting GDPR webhook requirements.

## Glossary

- **Boilerplate**: The Shopify Express Mongoose Boilerplate application
- **OAuthController**: The Express controller module at `src/controllers/OAuthController.js` that handles Shopify OAuth initiation, callback, and root routing
- **CustomSessionStorage**: The storage adapter class at `src/storage/CustomSessionStorage.js` that persists Shopify sessions to MongoDB
- **SessionModel**: The Mongoose model at `src/models/Session.js` representing stored Shopify sessions
- **App_Factory**: The `createApp` function in `src/app.js` that assembles Express middleware and routes
- **EnvValidator**: The `validateAndLoadEnv` function in `src/config/env.js` that checks required environment variables at startup
- **RateLimiter**: An Express middleware that restricts request throughput per client IP address
- **ValidateSessionToken_Middleware**: A standalone Express middleware module at `src/middleware/validateSessionToken.js` that verifies Shopify App Bridge JWT session tokens
- **ENCRYPTION_KEY**: A mandatory 256-bit (32-byte hex-encoded) environment variable used for AES-256-GCM encryption of session access tokens
- **TTL_Index**: A MongoDB index on the `expires` field that automatically removes documents after their expiry date

## Requirements

### Requirement 1: Instanceof-Based Error Detection in OAuth Callback

**User Story:** As a developer, I want OAuth error handling to use proper `instanceof` checks against imported error classes, so that error branching is reliable across module boundaries and minification.

#### Acceptance Criteria

1. THE OAuthController SHALL import `CookieNotFound` and `InvalidOAuthError` from `@shopify/shopify-api`
2. WHEN a caught error is an instance of `CookieNotFound`, THE OAuthController SHALL execute the cookie-not-found recovery flow (iframe breakout redirect to `/api/auth`)
3. WHEN a caught error is an instance of `InvalidOAuthError`, THE OAuthController SHALL respond with HTTP 403 and an OAuth validation failure message
4. THE OAuthController SHALL NOT use `error.constructor.name` string comparisons for error-type detection

### Requirement 2: AES-256-GCM Encryption of Session Access Tokens

**User Story:** As a security engineer, I want session access tokens encrypted at rest in MongoDB, so that a database compromise does not directly expose merchant API credentials.

#### Acceptance Criteria

1. THE EnvValidator SHALL require an `ENCRYPTION_KEY` environment variable
2. IF the `ENCRYPTION_KEY` environment variable is missing at startup, THEN THE EnvValidator SHALL throw an error preventing application boot
3. WHEN storing a session, THE CustomSessionStorage SHALL encrypt the `accessToken` field using AES-256-GCM with the configured ENCRYPTION_KEY before writing to MongoDB
4. WHEN loading a session, THE CustomSessionStorage SHALL decrypt the stored `accessToken` field using AES-256-GCM with the configured ENCRYPTION_KEY before returning the session object
5. THE CustomSessionStorage SHALL generate a unique initialization vector (IV) for each encryption operation
6. THE CustomSessionStorage SHALL store the IV and authentication tag alongside the ciphertext
7. IF the `accessToken` field is null or undefined, THEN THE CustomSessionStorage SHALL skip encryption and store the value unchanged

### Requirement 3: Raw Body Capture for Webhook Verification

**User Story:** As a developer, I want incoming JSON request bodies to also be available as raw buffers, so that HMAC webhook body signatures can be verified against the unmodified payload.

#### Acceptance Criteria

1. THE App_Factory SHALL configure the `express.json()` middleware with a `verify` callback that captures the raw request body
2. WHEN a JSON request body is parsed, THE App_Factory SHALL attach the raw Buffer to `req.rawBody`
3. WHEN the request body is empty, THE App_Factory SHALL leave `req.rawBody` undefined

### Requirement 4: TTL Index on Session Expiry Field

**User Story:** As an operator, I want expired sessions to be automatically removed from MongoDB, so that the sessions collection does not grow unbounded.

#### Acceptance Criteria

1. THE SessionModel SHALL define a TTL index on the `expires` field with an `expireAfterSeconds` value of 0
2. WHEN a session document's `expires` date passes, THE SessionModel SHALL rely on MongoDB to automatically delete the expired document

### Requirement 5: Rate Limiting on Public Endpoints

**User Story:** As an operator, I want public-facing endpoints rate-limited, so that the application is protected from brute-force and denial-of-service attacks.

#### Acceptance Criteria

1. THE App_Factory SHALL apply a RateLimiter middleware to the `/` route
2. THE App_Factory SHALL apply a RateLimiter middleware to the `/api/auth` route
3. THE RateLimiter SHALL limit each client IP address to a maximum of 30 requests per 60-second window
4. WHEN a client exceeds the rate limit, THE RateLimiter SHALL respond with HTTP 429 status
5. THE Boilerplate SHALL use the `express-rate-limit` package as its RateLimiter implementation

### Requirement 6: App Bridge Session Token Verification Middleware

**User Story:** As a developer extending the boilerplate, I want a ready-to-use middleware for verifying Shopify App Bridge session tokens, so that I can protect custom API routes without reimplementing JWT verification logic.

#### Acceptance Criteria

1. THE ValidateSessionToken_Middleware SHALL be located at `src/middleware/validateSessionToken.js`
2. THE ValidateSessionToken_Middleware SHALL export a function that verifies Shopify App Bridge JWT session tokens using the Shopify API library
3. WHEN verification succeeds, THE ValidateSessionToken_Middleware SHALL attach the decoded session payload to the request object and call `next()`
4. WHEN verification fails, THE ValidateSessionToken_Middleware SHALL respond with HTTP 401 and an error message
5. THE ValidateSessionToken_Middleware SHALL include JSDoc documentation explaining its purpose and how to mount it on Express routes
6. THE ValidateSessionToken_Middleware SHALL NOT be mounted on any route by default in the application

### Requirement 7: GDPR Webhook Requirements Documentation

**User Story:** As a developer preparing for Shopify App Store submission, I want the README to document GDPR mandatory webhook endpoints, so that I understand what must be implemented before submission.

#### Acceptance Criteria

1. THE Boilerplate README SHALL include a section documenting the three mandatory GDPR webhook endpoints required by Shopify (`customers/data_request`, `customers/redact`, `shop/redact`)
2. THE Boilerplate README SHALL describe the purpose of each GDPR webhook endpoint
3. THE Boilerplate README SHALL note that GDPR webhook endpoints are required for App Store submission
