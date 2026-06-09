# Requirements Document

## Introduction

This document describes the functional and technical requirements for the **shopify-express-mongoose-boilerplate** — a reusable foundation for embedded Shopify applications built with Express and MongoDB. This boilerplate provides: Express server initialization, `@shopify/shopify-api` SDK configuration, OAuth session persistence via MongoDB, and HMAC request validation.

The goal is to produce a generic, secure base that complies with Shopify platform requirements and can be forked for any specific Shopify app by simply configuring environment variables.

**Out of scope for this boilerplate:** frontend/UI, app-specific business logic, cron jobs, Billing API, dashboards, and webhooks (including GDPR/privacy webhooks and app/uninstalled webhook — these will be added per-app).

---

## Glossary

- **App**: An embedded Shopify application built on this boilerplate (Express server).
- **SDK**: The `@shopify/shopify-api` package — Shopify's official Node.js library.
- **OAuth_Controller**: MVC controller responsible for initiating and processing the OAuth 2.0 flow.
- **HMAC_Middleware**: Express middleware responsible for validating the HMAC signature of incoming requests.
- **Session_Storage**: Custom implementation (`CustomSessionStorage`) that persists OAuth sessions in MongoDB via Mongoose.
- **Session**: Object containing the `shop`, `accessToken`, `scope`, and metadata associated with a merchant installation.
- **Merchant**: Owner of a Shopify store who installs the application.
- **Shop**: Unique identifier of a Shopify store (e.g. `my-store.myshopify.com`).
- **Access_Token**: OAuth 2.0 access token issued by Shopify, enabling calls to the Admin GraphQL API.
- **HMAC**: Hash-based Message Authentication Code (HMAC-SHA256), used by Shopify to sign requests.
- **Nonce**: A random single-use value generated during OAuth initiation to prevent CSRF attacks.
- **Scopes**: OAuth permissions requested from Shopify (e.g. `read_products`, `write_inventory`).
- **Embedded_App**: A Shopify application loaded inside the administration interface via App Bridge.
- **APP_SLUG**: The unique identifier used in Shopify Admin URLs for this specific app instance (e.g. `stockrefill`, `omnisync`).

---

## Requirements

### Requirement 1: Express Server Initialization

**User Story:** As a developer, I want the Express server to start with a consistent and reproducible configuration, so that a stable runtime environment is guaranteed for all application components.

#### Acceptance Criteria

1. THE **App** SHALL start an Express server on the port defined by the `PORT` environment variable. `PORT` is required and has no default value.
2. THE **App** SHALL load all required environment variables (`SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_SCOPES`, `HOST`, `PORT`, `MONGODB_URI`, `APP_SLUG`) at startup, before any component initialization.
3. IF a required environment variable is missing at startup, THEN THE **App** SHALL emit a descriptive error message identifying the missing variable and terminate the process with exit code `1`.
4. IF `MONGODB_URI` is present but does not begin with `mongodb://` or `mongodb+srv://`, THEN THE **App** SHALL emit a descriptive error message identifying `MONGODB_URI` as malformed and terminate the process with exit code `1`.
5. THE **App** SHALL apply the `express.json()` and `express.urlencoded({ extended: true })` middleware for request body parsing.
6. THE **App** SHALL separate route definitions, middleware, and controllers into distinct modules in accordance with the MVC architecture.

---

### Requirement 2: @shopify/shopify-api SDK Configuration

**User Story:** As a developer, I want the `@shopify/shopify-api` SDK to be initialized with the correct parameters, so that all calls to the Shopify API are authenticated and compliant with platform requirements.

#### Acceptance Criteria

1. THE **App** SHALL initialize the SDK via `shopifyApi({...})` with the `apiKey`, `apiSecretKey`, `scopes`, `hostName`, and `apiVersion` parameters before any route is mounted.
2. THE **App** SHALL configure the SDK with the custom `Session_Storage` instance as the `customSessionStorage` implementation.
3. IF the SDK is initialized with invalid or missing parameters, THEN THE **App** SHALL throw a descriptive exception and abort startup.
4. THE **App** SHALL use a Shopify API version (`apiVersion`) explicitly pinned in the configuration (e.g. `2026-04`), to avoid compatibility breaks during platform updates.

---

### Requirement 3: Mongoose Schema and CustomSessionStorage

**User Story:** As a merchant, I want my OAuth access token to be securely persisted, so that the application can continue accessing my Shopify API without requiring a reinstallation on every server restart.

#### Acceptance Criteria

1. THE **Session_Storage** SHALL define a Mongoose schema `SessionSchema` containing at minimum the following fields: `id` (String, unique, required), `shop` (String, required), `state` (String), `isOnline` (Boolean), `scope` (String), `expires` (Date), `accessToken` (String), `onlineAccessInfo` (Mixed).
2. THE **Session_Storage** SHALL implement the `storeSession(session)` method that persists or updates a `Session` in MongoDB using an `upsert` operation based on the `id` field.
3. THE **Session_Storage** SHALL implement the `loadSession(id)` method that returns the `Session` matching the provided identifier, or `undefined` if no session exists for that identifier.
4. THE **Session_Storage** SHALL implement the `deleteSession(id)` method that removes the `Session` matching the provided identifier from MongoDB.
5. IF a MongoDB operation fails in `storeSession`, `loadSession`, or `deleteSession`, THEN THE **Session_Storage** SHALL propagate the error as an exception so the caller can handle it.
6. THE **Session_Storage** SHALL index the `shop` field in the Mongoose schema to enable efficient queries by store.
7. WHEN `loadSession(id)` is called after `storeSession(session)` with the same identifier, THEN THE **Session_Storage** SHALL return a `Session` object equivalent to the one that was stored (round-trip property).

---

### Requirement 4: MongoDB Connection

**User Story:** As a developer, I want the MongoDB connection to be reliably established at startup, so that OAuth session persistence is available from the very first incoming request.

#### Acceptance Criteria

1. THE **App** SHALL establish the MongoDB connection via Mongoose using the URI defined in the `MONGODB_URI` environment variable before starting to listen for incoming HTTP requests.
2. IF the MongoDB connection fails at startup, THEN THE **App** SHALL emit a descriptive error message and terminate the process with exit code `1`.
3. WHEN the MongoDB connection is successfully established, THE **App** SHALL emit a confirmation message in the logs before accepting HTTP requests.

---

### Requirement 5: OAuth Installation Route

**User Story:** As a merchant, I want to be able to initiate the application installation from the Shopify App Store, so that I am redirected to the Shopify authorization page to grant the necessary permissions.

#### Acceptance Criteria

1. WHEN a GET request is received on `/api/auth` with a valid `shop` parameter, THE **OAuth_Controller** SHALL initiate the OAuth 2.0 flow via the SDK and redirect the merchant to the Shopify authorization URL.
2. THE **OAuth_Controller** SHALL generate a cryptographically secure random `Nonce` for each OAuth initiation and persist it in the `Session_Storage` before the redirect.
3. IF the `shop` parameter is absent or does not match the `*.myshopify.com` format, THEN THE **OAuth_Controller** SHALL return an HTTP `400` response with a descriptive error message.
4. THE **OAuth_Controller** SHALL delegate the construction of the authorization URL and `Nonce` management to the `@shopify/shopify-api` SDK.

---

### Requirement 6: OAuth Callback Route

**User Story:** As a merchant, I want the application to securely process the Shopify authorization callback, so that my access token is persisted and I am redirected to the application interface.

#### Acceptance Criteria

1. WHEN a GET request is received on `/api/auth/callback` with valid OAuth parameters (`code`, `shop`, `hmac`, `state`, `timestamp`), THE **OAuth_Controller** SHALL validate the callback via the SDK and exchange the authorization code for an `Access_Token`.
2. WHEN the code exchange is successful, THE **OAuth_Controller** SHALL persist the resulting `Session` (including the `Access_Token` and `Scopes`) in the `Session_Storage`.
3. WHEN the session is successfully persisted, THE **OAuth_Controller** SHALL redirect the merchant to the embedded application URL (`https://${session.shop}/admin/apps/${APP_SLUG}`) within the Shopify administration interface.
4. IF callback validation fails (invalid signature, mismatched `state`, expired `timestamp`), THEN THE **OAuth_Controller** SHALL return an HTTP `403` response with a descriptive error message.
5. IF the authorization code exchange fails on Shopify's side, THEN THE **OAuth_Controller** SHALL return an HTTP `500` response with a descriptive error message.
6. THE **OAuth_Controller** SHALL delegate callback validation and code exchange to the `@shopify/shopify-api` SDK.

---

### Requirement 7: HMAC Validation Middleware

**User Story:** As a developer, I want all incoming requests from Shopify to be validated by HMAC signature, so that only authentic Shopify requests are processed.

#### Acceptance Criteria

1. THE **HMAC_Middleware** SHALL validate the HMAC-SHA256 signature of each incoming request using `SHOPIFY_API_SECRET` as the signing key.
2. WHEN an incoming request contains a valid HMAC signature, THE **HMAC_Middleware** SHALL pass the request to the next handler in the Express chain.
3. IF an incoming request does not contain an `hmac` parameter, THEN THE **HMAC_Middleware** SHALL return an HTTP `401` response with the message `"Missing HMAC"`.
4. IF the computed HMAC signature does not match the signature provided in the request, THEN THE **HMAC_Middleware** SHALL return an HTTP `401` response with the message `"Invalid HMAC signature"`.
5. THE **HMAC_Middleware** SHALL use a constant-time comparison (`crypto.timingSafeEqual`) to compare HMAC signatures in order to prevent timing attacks.
6. THE **HMAC_Middleware** SHALL exclude the `hmac` parameter itself from the signature computation, in accordance with the Shopify specification.
7. THE **HMAC_Middleware** SHALL sort request parameters in alphabetical order before computing the signature, in accordance with the Shopify specification.

---

### Requirement 8: Security and Environment Configuration

**User Story:** As a developer, I want application secrets to never be exposed in the source code, so that security best practices and Shopify platform requirements are respected.

#### Acceptance Criteria

1. THE **App** SHALL load all secrets (`SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `MONGODB_URI`) exclusively from environment variables, with no hardcoded values in the source code.
2. THE **App** SHALL include a `.env.example` file documenting all required environment variables with placeholder values.
3. THE **App** SHALL include the `.env` file in `.gitignore` to prevent accidental exposure of secrets in the code repository.
4. THE **App** SHALL use HTTPS for all communications with the Shopify API, in accordance with platform requirements.
5. THE **App** SHALL never log, include in error messages, or expose in HTTP responses the value of any `Access_Token` or `SHOPIFY_API_SECRET`.
