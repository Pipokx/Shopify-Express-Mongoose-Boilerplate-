# Shopify Express Mongoose Boilerplate

A production-ready, backend engine built with **Node.js (v22+)**, **Express**, and **Mongoose**. 

This boilerplate is engineered as a **foundational pillar**. By abstracting and solving the most complex, error-prone requirements of the Shopify ecosystem, it serves as the ultimate launchpad to build *any* custom Shopify application with minimal architectural debt.

---

## 🎯 Why This is the Ultimate Foundational Pillar

Building a successful Shopify application requires solving deep structural challenges before writing a single line of business logic. This boilerplate eliminates weeks of repetitive setup and security auditing by delivering:

*   **Universal Scalability**: The decoupling of the core runtime initialization (`Env -> DB -> SDK -> App`) ensures that whether you are building a lightweight merchant tool or a heavy-duty automation SaaS, the infrastructure handles the load seamlessly.
*   **Plug-and-Play Architecture**: Features clean entrypoints and explicit storage contracts allowing you to instantly hook in your specific business logic.
*   **Bulletproof Compliance by Default**: Implements strict security mechanisms that guarantee your app will pass Shopify's rigorous App Store review metrics regarding session handling and request verification[cite: 2, 3].

---

## 🚀 Key Features

*   **Runtime Environment Validation**: Pre-flight checks guarantee all required credentials are present before bootstrapping, preventing catastrophic runtime crashes in production[cite: 3].
*   **Custom Session Storage Layer**: A tailored Mongoose schema with optimized unique indexes bridges the gap between `@shopify/shopify-api` and MongoDB, ensuring flawless multi-store multi-tenancy[cite: 3].
*   **Cryptographic HMAC Middleware**: Protects your server against spoofing attacks using timing-safe comparisons (`crypto.timingSafeEqual`) and complex array-based query string parsing[cite: 3].
*   **Industrial OAuth Controller**: Handles seamless merchant installation loops, dynamic access token exchanges, offline session persistence, and state-cookie mismatch routing.
*   **Graceful Lifecycle Management**: Clean system startup sequence paired with reliable shutdown hooks for zero-downtime deployments[cite: 3].

---

## 🛠️ Tech Stack & Prerequisites

*   **Runtime**: Node.js `>= 22.0.0` (Native ES Modules)[cite: 3]
*   **Framework**: Express[cite: 3]
*   **Database**: MongoDB & Mongoose[cite: 3]
*   **Shopify Integration**: `@shopify/shopify-api`[cite: 3]
*   **Test Runner**: Vitest (34/34 Passing Units, Property-Based, & Integration Tests)[cite: 3]

---

## 📁 Architecture Overview

```text
├── src/
│   ├── config/           # Environment and SDK singletons
│   ├── controllers/      # Production-ready OAuth lifecycle handlers
│   ├── db/               # Optimized database pool connections
│   ├── middleware/       # HMAC verification and route security layers
│   ├── models/           # Indexed Mongoose schemas (Session mapping)
│   ├── routes/           # Core authentication API endpoints
│   ├── storage/          # Shopify SDK compliance contract adapter
│   └── app.js            # App factory instantiation
├── specs/                # Architectural design and tasks specifications
├── server.js             # Main system bootstrap entry point
└── .env.example          # Template for required credentials
