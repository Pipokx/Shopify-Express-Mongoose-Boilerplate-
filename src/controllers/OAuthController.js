import { getShopify } from '../config/shopify.js';
import { CookieNotFound, InvalidOAuthError } from '@shopify/shopify-api';

/**
 * Escapes HTML special characters to prevent XSS injection.
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string.
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Initiates the Shopify OAuth installation flow.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
export async function beginAuth(req, res) {
  const shop = req.query.shop;

  if (!shop || !/^[a-z0-9-]+\.myshopify\.com$/i.test(shop)) {
    return res.status(400).json({ error: 'Invalid shop domain. Must match *.myshopify.com' });
  }

  const shopify = getShopify();

  try {
    await shopify.auth.begin({
      shop,
      callbackPath: '/api/auth/callback',
      isOnline: false,
      rawRequest: req,
      rawResponse: res
    });
  } catch (error) {
    return res.status(500).json({ error: `Failed to initiate OAuth: ${error.message}` });
  }
}

/**
 * Handles the Shopify OAuth callback, validates the request, and exchanges the code for a token.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
export async function handleCallback(req, res) {
  const shopify = getShopify();

  try {
    const callbackResponse = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res
    });

    const session = callbackResponse.session;
    
    // Explicitly store the session using our custom storage registered with the SDK
    await shopify.config.customSessionStorage.storeSession(session);

    const appSlug = process.env.APP_SLUG;

    return res.redirect(`https://${session.shop}/admin/apps/${appSlug}`);
  } catch (error) {
    // Check for CookieNotFound or missing session cookie issues
    if (error instanceof CookieNotFound) {
      const shop = req.query.shop;
      if (shop && /^[a-z0-9-]+\.myshopify\.com$/i.test(shop)) {
        const queryString = new URLSearchParams(req.query).toString();
        const redirectUrl = `/api/auth?${queryString}`;
        const safeUrl = encodeURIComponent(redirectUrl);
        res.setHeader('Content-Type', 'text/html');
        return res.send(`
          <!DOCTYPE html>
          <html>
            <head>
              <script type="text/javascript">
                window.top.location.href = decodeURIComponent("${safeUrl}");
              </script>
            </head>
            <body>
              <p>Redirection en cours...</p>
            </body>
          </html>
        `);
      }
    }

    // Check for OAuth validation failures
    if (error instanceof InvalidOAuthError) {
      return res.status(403).json({ error: `OAuth callback validation failed: ${error.message}` });
    }

    // Generic token exchange/other failure
    return res.status(500).json({ error: `Token exchange failed: ${error.message || ''}` });
  }
}

/**
 * Handles the root endpoint GET /
 * If a valid offline session exists for the shop, serves a success response.
 * If not, redirects to the /api/auth endpoint to begin OAuth.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 */
export async function handleRoot(req, res) {
  const shop = req.query.shop;

  if (!shop || !/^[a-z0-9-]+\.myshopify\.com$/i.test(shop)) {
    return res.status(400).send('Missing or invalid shop query parameter. Must match *.myshopify.com');
  }

  const shopify = getShopify();
  const offlineSessionId = shopify.session.getOfflineId(shop);

  try {
    const session = await shopify.config.customSessionStorage.loadSession(offlineSessionId);

    if (session && session.accessToken) {
      // Session exists, app is installed and authorized.
      res.setHeader('Content-Type', 'text/html');
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>App Backend</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                background-color: #f4f6f8;
                color: #202223;
              }
              .card {
                background: white;
                padding: 2.5rem;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                text-align: center;
                max-width: 400px;
                border: 1px solid #e1e3e5;
              }
              h1 {
                color: #008060;
                margin-top: 0;
                font-size: 1.8rem;
              }
              p {
                line-height: 1.5;
                font-size: 1rem;
              }
              code {
                background: #f1f2f4;
                padding: 2px 6px;
                border-radius: 4px;
                font-family: monospace;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Connexion réussie ! 🎉</h1>
              <p>Le backend de votre application Shopify fonctionne correctement et est connecté à la boutique <strong>${escapeHtml(shop)}</strong>.</p>
              <p>Vous pouvez maintenant commencer à développer vos routes d'API.</p>
            </div>
          </body>
        </html>
      `);
    } else {
      // No session found, breakout of iframe and redirect to begin OAuth (forwarding all query parameters like hmac)
      const queryString = new URLSearchParams(req.query).toString();
      const redirectUrl = `/api/auth?${queryString}`;
      const safeUrl = encodeURIComponent(redirectUrl);
      res.setHeader('Content-Type', 'text/html');
      return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <script type="text/javascript">
              window.top.location.href = decodeURIComponent("${safeUrl}");
            </script>
          </head>
          <body>
            <p>Redirection vers la page d'authentification...</p>
          </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('Error loading session:', error.message || error);
    return res.status(500).send('Internal server error');
  }
}

