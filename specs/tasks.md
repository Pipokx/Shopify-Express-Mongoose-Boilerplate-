# Implementation Plan: Shopify Express Mongoose Boilerplate

## Overview

Implement the secure runtime foundation for the Shopify Express Mongoose Boilerplate in Node.js/Express. Tasks follow the mandatory startup dependency order: **env → DB → SDK → app → listen**. Each module is built and tested incrementally before the next layer depends on it.

---

## Tasks

- [ ] 1. Project scaffolding and configuration files
  - Create `package.json` with all required dependencies (`express`, `mongoose`, `@shopify/shopify-api`, `dotenv`, `fast-check`) and dev dependencies (`vitest`, `supertest`)
  - Create `.gitignore` including `node_modules/`, `.env`, and build artefacts
  - Create `.env.example` documenting all required variables: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_SCOPES`, `HOST`, `PORT`, `MONGODB_URI`, `APP_SLUG`
  - Create the full MVC folder structure: `src/config/`, `src/db/`, `src/models/`, `src/storage/`, `src/middleware/`, `src/controllers/`, `src/routes/`
  - Configure Vitest in `package.json` (test runner, coverage settings)
  - _Requirements: 1.5, 8.1, 8.2, 8.3_

- [ ] 2. Environment variable validation (`src/config/env.js`)
  - [ ] 2.1 Implement `validateAndLoadEnv()` in `src/config/env.js`
    - Read `process.env` for all seven required keys: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_SCOPES`, `HOST`, `PORT`, `MONGODB_URI`, `APP_SLUG`
    - Throw a descriptive `Error` naming the first missing variable if any key is absent
    - Return a frozen config object `{ apiKey, apiSecretKey, scopes, host, port, mongodbUri, appSlug }` when all keys are present
    - _Requirements: 1.1, 1.2, 1.3, 8.1_

  - [ ]\* 2.2 Write property test for `validateAndLoadEnv` — Property 1
    - **Property 1: Startup fails fast on any missing environment variable**
    - Use `fc.subarray(requiredVars, { minLength: 1 })` to generate all non-empty subsets of missing variables
    - Assert that `validateAndLoadEnv()` throws an error whose message contains the name of at least one missing variable
    - Assert that no config object is returned when any variable is absent
    - Tag: `// Feature: shopify-express-mongoose-boilerplate, Property 1: Startup fails fast on any missing environment variable`
    - **Validates: Requirements 1.3**

  - [ ]\* 2.3 Write property test for `validateAndLoadEnv` — Property 2
    - **Property 2: Startup fails fast on a malformed MONGODB_URI**
    - Use `fc.string()` filtered to exclude strings starting with `mongodb://` or `mongodb+srv://`
    - Assert that `validateAndLoadEnv()` throws an error when `MONGODB_URI` is malformed and that the error message identifies `MONGODB_URI` as malformed
    - Tag: `// Feature: shopify-express-mongoose-boilerplate, Property 2: Startup fails fast on a malformed MONGODB_URI`
    - **Validates: Requirements 1.4**

  - [ ]\* 2.4 Write unit tests for `validateAndLoadEnv`
    - Test: all required vars present → returns frozen config with correct values
    - Test: missing each of the seven vars individually → throws with the variable name in the message
    - Test: `MONGODB_URI` present but malformed → throws with "MONGODB_URI" in message
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 3. MongoDB connection helpers (`src/db/connection.js`)
  - [ ] 3.1 Implement `connectDB(uri)` and `disconnectDB()` in `src/db/connection.js`
    - `connectDB(uri)` calls `mongoose.connect(uri)` and resolves on success; rejects with the original error on failure
    - `disconnectDB()` calls `mongoose.disconnect()`
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]\* 3.2 Write unit tests for `db/connection.js`
    - Test: `connectDB` with a valid URI resolves without error (mock `mongoose.connect`)
    - Test: `connectDB` with a failing connection rejects with the error (mock `mongoose.connect` to reject)
    - _Requirements: 4.2_

- [ ] 4. Session Mongoose model (`src/models/Session.js`)
  - [ ] 4.1 Define `SessionSchema` and export `SessionModel` in `src/models/Session.js`
    - Include all required fields: `id` (String, unique, required), `shop` (String, required, index), `state` (String), `isOnline` (Boolean, default false), `scope` (String), `expires` (Date), `accessToken` (String), `onlineAccessInfo` (Mixed)
    - Enable `{ timestamps: true }` for automatic `createdAt`/`updatedAt`
    - _Requirements: 3.1, 3.6_

  - [ ]\* 4.2 Write unit tests for `Session.js`
    - Test: schema contains all required fields with correct types
    - Test: `id` field has `unique: true` and `required: true`
    - Test: `shop` field has an index defined
    - Test: `isOnline` defaults to `false`
    - _Requirements: 3.1, 3.6_

- [ ] 5. Custom session storage (`src/storage/CustomSessionStorage.js`)
  - [ ] 5.1 Implement `CustomSessionStorage` class in `src/storage/CustomSessionStorage.js`
    - `storeSession(session)`: upsert the session document by `id` using `SessionModel.findOneAndUpdate({ id }, session, { upsert: true, new: true })`; return `true` on success; propagate any MongoDB error
    - `loadSession(id)`: find by `id` using `SessionModel.findOne({ id })`; return the session object or `undefined` if not found; propagate any MongoDB error
    - `deleteSession(id)`: delete by `id` using `SessionModel.deleteOne({ id })`; return `true` on success; propagate any MongoDB error
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [ ]\* 5.2 Write property test for `CustomSessionStorage` — Property 3
    - **Property 3: Session storage round-trip**
    - Use `fc.record({ id: fc.string({ minLength: 1 }), shop: fc.string({ minLength: 1 }), accessToken: fc.string(), scope: fc.string(), state: fc.string(), isOnline: fc.boolean(), expires: fc.option(fc.date()), onlineAccessInfo: fc.anything() })` to generate arbitrary sessions
    - Assert that `loadSession(session.id)` after `storeSession(session)` returns an object with equivalent field values
    - Tag: `// Feature: shopify-express-mongoose-boilerplate, Property 3: Session storage round-trip`
    - **Validates: Requirements 3.2, 3.3, 3.7**

  - [ ]\* 5.3 Write property test for `CustomSessionStorage` — Property 4
    - **Property 4: Delete removes session permanently**
    - Use the same session arbitrary as Property 2
    - Assert that `loadSession(session.id)` after `storeSession(session)` then `deleteSession(session.id)` returns `undefined`
    - Tag: `// Feature: shopify-express-mongoose-boilerplate, Property 4: Delete removes session permanently`
    - **Validates: Requirements 3.4**

  - [ ]\* 5.4 Write unit tests for `CustomSessionStorage`
    - Test: MongoDB error in `storeSession` propagates to caller
    - Test: MongoDB error in `loadSession` propagates to caller
    - Test: MongoDB error in `deleteSession` propagates to caller
    - _Requirements: 3.5_

- [ ] 6. Checkpoint — Core data layer complete
  - Ensure all tests pass for tasks 2–5, ask the user if questions arise.

- [ ] 7. Shopify SDK initialisation (`src/config/shopify.js`)
  - [ ] 7.1 Implement `initShopify(config, sessionStorage)` in `src/config/shopify.js`
    - Import the Node platform adapter: `import "@shopify/shopify-api/adapters/node";`
    - Clean host name: Strip protocol and trailing slashes from `config.host` (e.g. `config.host.replace(/https?:\/\//, "").replace(/\/$/, "")`)
    - Parse scopes: Convert the comma-separated `config.scopes` string into an array of trimmed strings (e.g., `config.scopes.split(',').map(s => s.trim())`)
    - Initialize the SDK: Call `shopifyApi({ apiKey: config.apiKey, apiSecretKey: config.apiSecretKey, scopes, hostName, isEmbeddedApp: true, apiVersion: ApiVersion.April26, customSessionStorage: sessionStorage })` and export the resulting singleton
    - Throw a descriptive exception if required SDK parameters are missing or invalid
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]\* 7.2 Write unit tests for `shopify.js`
    - Test: SDK initialised with all required params → returns a shopify instance
    - Test: `customSessionStorage` is set to the provided `CustomSessionStorage` instance
    - Test: `apiVersion` is explicitly pinned to `ApiVersion.April26`
    - Test: `isEmbeddedApp` is explicitly set to `true`
    - Test: URL cleaning handles hosts with/without `https://` protocol and trailing slashes
    - Test: comma-separated scopes string is parsed into a trimmed string array
    - Test: missing required configuration parameters (like `apiKey`) → throws a descriptive error
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 8. HMAC validation middleware (`src/middleware/hmac.js`)
  - [ ] 8.1 Implement `validateHmac(req, res, next)` in `src/middleware/hmac.js`
    - Extract all query parameters from `req.query`
    - If `hmac` key is absent → respond `401` with `{ error: "Missing HMAC" }`
    - Remove `hmac` from the parameter map; sort remaining keys alphabetically; build the message string `key1=value1&key2=value2&...`
    - Compute HMAC-SHA256 of the message using `SHOPIFY_API_SECRET` as the key; encode as lowercase hex
    - Convert both digests to `Buffer` via `Buffer.from(..., 'hex')` and compare with `crypto.timingSafeEqual`
    - If lengths differ or comparison fails → respond `401` with `{ error: "Invalid HMAC signature" }`
    - If equal → call `next()`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ] 8.2 Write property test for `validateHmac` — Property 8
    - **Property 8: Correctly signed requests always pass HMAC validation**
    - Use `fc.dictionary(fc.string({ minLength: 1 }), fc.string())` to generate arbitrary parameter sets; compute the correct HMAC and attach it; assert middleware calls `next()` and does not return 401
    - Tag: `// Feature: shopify-express-mongoose-boilerplate, Property 8: Correctly signed requests always pass HMAC validation`
    - **Validates: Requirements 7.1, 7.2, 7.6, 7.7**

  - [ ] 8.3 Write property test for `validateHmac` — Property 9
    - **Property 9: Incorrectly signed requests always fail HMAC validation**
    - Use the same arbitrary as Property 8 but sign with a different secret key (or tamper with a parameter value after signing); assert middleware returns `401` with `"Invalid HMAC signature"`
    - Tag: `// Feature: shopify-express-mongoose-boilerplate, Property 9: Incorrectly signed requests always fail HMAC validation`
    - **Validates: Requirements 7.4**

  - [ ] 8.4 Write property test for `validateHmac` — Property 10
    - **Property 10: Parameter order does not affect HMAC validation outcome**
    - Generate a valid signed parameter set; shuffle the query string parameter order using `fc.shuffledSubarray`; assert middleware still calls `next()`
    - Tag: `// Feature: shopify-express-mongoose-boilerplate, Property 10: Parameter order does not affect HMAC validation outcome`
    - **Validates: Requirements 7.7**

  - [ ]\* 8.5 Write unit tests for `hmac.js`
    - Test: missing `hmac` param → `401` with `"Missing HMAC"`
    - Test: valid HMAC → `next()` is called
    - Test: tampered param value → `401` with `"Invalid HMAC signature"`
    - _Requirements: 7.3, 7.4_

- [ ] 9. OAuth controller (`src/controllers/OAuthController.js`)
  - [ ] 9.1 Implement `beginAuth(req, res)` in `src/controllers/OAuthController.js`
    - Validate that `req.query.shop` is present and matches `/^[a-z0-9-]+\.myshopify\.com$/i`; if not → `400` with `{ error: "Invalid shop domain. Must match *.myshopify.com" }`
    - Delegate to `shopify.auth.begin({ shop, callbackPath: '/api/auth/callback', isOnline: false, rawRequest: req, rawResponse: res })`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 9.2 Implement `handleCallback(req, res)` in `src/controllers/OAuthController.js`
    - Delegate to `shopify.auth.callback({ rawRequest: req, rawResponse: res })`
    - On `InvalidOAuthError` or validation failure → `403` with `{ error: "OAuth callback validation failed: <reason>" }`
    - On token exchange failure → `500` with `{ error: "Token exchange failed: <reason>" }`
    - On success → redirect to `https://${session.shop}/admin/apps/${config.appSlug}`
    - Note: Webhook registration will be added here in a future sprint (post-callback is the correct insertion point)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]\* 9.3 Write property test for `OAuthController.beginAuth` — Property 5
    - **Property 5: Invalid shop domain always returns HTTP 400**
    - Use `fc.string()` filtered to exclude strings matching `/^[a-z0-9-]+\.myshopify\.com$/i`; assert `GET /api/auth?shop=<value>` returns `400`
    - Tag: `// Feature: shopify-express-mongoose-boilerplate, Property 5: Invalid shop domain always returns HTTP 400`
    - **Validates: Requirements 5.3**

  - [ ]\* 9.4 Write property test for `OAuthController.beginAuth` — Property 6
    - **Property 6: Valid shop domain always triggers a redirect**
    - Use `fc.stringMatching(/^[a-z0-9-]+\.myshopify\.com$/)` to generate valid shop domains; mock `shopify.auth.begin`; assert response is a 3xx redirect whose `Location` contains the shop domain
    - Tag: `// Feature: shopify-express-mongoose-boilerplate, Property 6: Valid shop domain always triggers a redirect`
    - **Validates: Requirements 5.1**

  - [ ]\* 9.5 Write property test for `OAuthController.beginAuth` — Property 7
    - **Property 7: Each OAuth initiation produces a unique nonce**
    - Call `beginAuth` twice with two distinct valid shop domains (mock SDK); assert the `state` values stored in `Session_Storage` for the two calls are different
    - Tag: `// Feature: shopify-express-mongoose-boilerplate, Property 7: Each OAuth initiation produces a unique nonce`
    - **Validates: Requirements 5.2**

  - [ ]\* 9.6 Write unit tests for `OAuthController`
    - Test: `beginAuth` — missing `shop` → `400`
    - Test: `beginAuth` — invalid shop format → `400`
    - Test: `handleCallback` — valid params → SDK called, session stored, redirect issued
    - Test: `handleCallback` — SDK validation failure → `403`
    - Test: `handleCallback` — token exchange failure → `500`
    - _Requirements: 5.1, 5.3, 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 10. Auth router (`src/routes/auth.js`)
  - [ ] 10.1 Create Express Router in `src/routes/auth.js`
    - Mount `GET /api/auth` → `hmacMiddleware`, `OAuthController.beginAuth`
    - Mount `GET /api/auth/callback` → `OAuthController.handleCallback` (HMAC validation is performed by the SDK during callback)
    - Export the router
    - _Requirements: 5.1, 6.1, 7.1_

- [ ] 11. Express app factory (`src/app.js`)
  - [ ] 11.1 Implement `createApp(shopify)` in `src/app.js`
    - Apply `express.json()` and `express.urlencoded({ extended: true })` middleware
    - Mount the auth router at `/`
    - Register a global error-handling middleware `(err, req, res, next)` that returns `500` with `{ error: "Internal server error" }` without leaking stack traces
    - Export `createApp`
    - _Requirements: 1.4, 1.5_

  - [ ]\* 11.2 Write unit tests for `app.js`
    - Test: JSON body is parsed correctly (POST with `Content-Type: application/json`)
    - Test: URL-encoded body is parsed correctly (POST with `Content-Type: application/x-www-form-urlencoded`)
    - Test: global error handler returns `500` without stack trace
    - _Requirements: 1.4_

- [ ] 12. Entry point and startup sequence (`server.js`)
  - [ ] 12.1 Implement the startup sequence in `server.js`
    - Step 1: call `validateAndLoadEnv()` — on error, `console.error` + `process.exit(1)`
    - Step 2: call `connectDB(config.mongodbUri)` — on error, `console.error` + `process.exit(1)`; on success, `console.log("MongoDB connected")`
    - Step 3: instantiate `new CustomSessionStorage()` and call `initShopify(config, sessionStorage)`
    - Step 4: call `createApp(shopify)` to get the Express app
    - Step 5: call `app.listen(config.port, ...)` and log `"Server listening on port X"`
    - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3, 2.1, 2.2_

- [ ] 13. Checkpoint — Full startup sequence wired
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Integration tests
  - [ ]\* 14.1 Write integration test: full OAuth installation flow
    - Mock Shopify OAuth endpoints; send `GET /api/auth?shop=test-store.myshopify.com` with a valid HMAC; assert `302` redirect to a Shopify authorization URL containing the shop domain and a `state` nonce
    - _Requirements: 5.1, 5.2, 5.4_

  - [ ]\* 14.2 Write integration test: full OAuth callback flow
    - Mock Shopify token exchange; send `GET /api/auth/callback` with valid OAuth params; assert session is persisted in MongoDB and response is `302` redirect to the embedded app URL
    - _Requirements: 6.1, 6.2, 6.3, 6.6_

  - [ ]\* 14.3 Write integration test: MongoDB connection established before server listens
    - Spy on `connectDB` and `app.listen`; assert `connectDB` resolves before `app.listen` is called
    - _Requirements: 4.1, 4.3_

- [ ] 15. Final checkpoint — All tests pass
  - Ensure all unit, property-based, and integration tests pass. Verify `.env` is listed in `.gitignore` and `.env.example` documents all required variables. Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property-based tests use `fast-check` with a minimum of 100 iterations per run
- Each property test is tagged with `// Feature: shopify-express-mongoose-boilerplate, Property N: ...`
- Startup dependency order is strictly enforced: `env → DB → SDK → app → listen`
- MongoDB errors in `CustomSessionStorage` are never swallowed — they propagate to the SDK caller
- `crypto.timingSafeEqual` is mandatory for HMAC comparison to prevent timing attacks

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "3.1", "4.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "2.4", "3.2", "4.2"] },
    { "id": 2, "tasks": ["5.1"] },
    { "id": 3, "tasks": ["5.2", "5.3", "5.4", "7.1"] },
    { "id": 4, "tasks": ["7.2", "8.1"] },
    { "id": 5, "tasks": ["8.2", "8.3", "8.4", "8.5", "9.1", "9.2"] },
    { "id": 6, "tasks": ["9.3", "9.4", "9.5", "9.6", "10.1"] },
    { "id": 7, "tasks": ["11.1"] },
    { "id": 8, "tasks": ["11.2", "12.1"] },
    { "id": 9, "tasks": ["14.1", "14.2", "14.3"] }
  ]
}
```
