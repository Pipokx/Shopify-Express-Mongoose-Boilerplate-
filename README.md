# Shopify Express Mongoose Boilerplate

A production-ready, backend engine built with **Node.js (v22+)**, **Express**, and **Mongoose**.

This boilerplate is engineered as a **foundational pillar**. It serves as the launchpad to build _any_ custom Shopify application. 

---

## 🎯 Purpose of this engine  

Building a successful Shopify application requires solving deep structural challenges before writing a single line of business logic. This boilerplate eliminates weeks of repetitive setup and security auditing by delivering:

- **Scalability**: The decoupling of the core runtime initialization (`Env -> DB -> SDK -> App`) ensures that whether you are building a lightweight merchant tool or a heavy-duty automation SaaS, the infrastructure handles the load seamlessly.
- **Plug-and-Play Architecture**: Features clean entrypoints and explicit storage contracts allowing you to instantly hook in your specific business logic.
- **Bulletproof Compliance**: Implements strict security mechanisms that guarantee your app will pass Shopify's rigorous App Store review metrics regarding session handling and request verification.

---

## 🚀 Key Features

- **Runtime Environment Validation**: Pre-flight checks guarantee all required credentials are present before bootstrapping, preventing catastrophic runtime crashes in production.
- **Custom Session Storage Layer**: A tailored Mongoose schema with optimized unique indexes bridges the gap between `@shopify/shopify-api` and MongoDB, ensuring flawless multi-store multi-tenancy.
- **Cryptographic HMAC Middleware**: Protects your server against spoofing attacks using timing-safe comparisons (`crypto.timingSafeEqual`) and complex array-based query string parsing.
- **Industrial OAuth Controller**: Handles seamless merchant installation loops, dynamic access token exchanges, offline session persistence, and state-cookie mismatch routing.
- **Graceful Lifecycle Management**: Clean system startup sequence paired with reliable shutdown hooks for zero-downtime deployments.

---

## 🛠️ Tech Stack & Prerequisites

- **Runtime**: Node.js `>= 22.0.0` (Native ES Modules)
- **Framework**: Express
- **Database**: MongoDB & Mongoose
- **Shopify Integration**: `@shopify/shopify-api`
- **Test Runner**: Vitest (39/39 Passing Units, Property-Based, & Integration Tests)

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
```

## ⚙️ Installation & Setup Guide

### 1. Shopify Partner Portal Setup

1. Log in to the Shopify Partners Portal.
2. Navigate to the Dev dashboard. Click on **Create Store** and select the **Development Store** option to set up a new store for testing.
3. Once the store is built, under **Settings > Apps**, click **Develop apps > Build apps in Dev Dashboard**.
4. Create your custom app from the Dev Dashboard — you'll find the Client ID (`SHOPIFY_API_KEY`) and Client Secret (`SHOPIFY_API_SECRET`) there.

### 2. Establish Local Secure Tunneling

Shopify forces all authorization redirects through secure (https) connections. Expose your local environment port via ngrok:

```bash
ngrok http 3000
```

Copy the forwarding HTTPS URL generated

### 3. Update App Credentials Dashboard

Return to your app setup interface within the Shopify Partners Dashboard and update the target entrypoints:

- **App URL**: `https://<your-ngrok-subdomain>.ngrok-free.app`
- **Allowed Redirection URL**: `https://<your-ngrok-subdomain>.ngrok-free.app/api/auth/callback`

### 4. Configure Local Environment State

Initialize your local configuration file at the root level of your project directory:

```bash
cp .env.example .env
```

Populate the newly created .env file using your real developer variables :

```Ini, TOML
SHOPIFY_API_KEY=your_client_id_here
SHOPIFY_API_SECRET=your_client_secret_here
SHOPIFY_SCOPES=read_products
HOST=https://<your-ngrok-subdomain>.ngrok-free.app
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/shopify_app_boilerplate
APP_SLUG=your-app-handle-from-shopify-url
```

### 5. Launch the Server Stack

Ensure your local MongoDB instance is fully running (via native processes, MongoDB Compass, or Docker containers). Install node modules and start up the server engine:

```bash
npm install
npm start
```

Upon successful bootstrap, your console will print verification logs confirming initialization sequences:

```Plaintext
MongoDB connected
Server listening on port 3000
```

---

## 🔒 GDPR Mandatory Webhooks

To comply with Shopify's data protection requirements and pass App Store submission, you must implement and configure the following three mandatory GDPR webhook endpoints in your Partner Dashboard:

- **`customers/data_request`**: Triggered when a store owner or customer requests to view the stored data associated with that customer. Your app must compile and deliver this data.
- **`customers/redact`**: Triggered when a store owner or customer requests the deletion of customer data. Your app must scrub or anonymize all personal data associated with the customer from your database.
- **`shop/redact`**: Triggered 48 hours after a store owner uninstalls your app. Your app must permanently delete all data associated with the store from your database.
