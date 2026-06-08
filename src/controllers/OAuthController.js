import { getShopify } from '../config/shopify.js';

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
    const errorName = error.constructor.name;
    const errorMessage = error.message || '';

    // Check for CookieNotFound or missing session cookie issues
    if (errorName === 'CookieNotFound' || errorMessage.includes('CookieNotFound')) {
      const shop = req.query.shop;
      if (shop && /^[a-z0-9-]+\.myshopify\.com$/i.test(shop)) {
        return res.redirect(`/api/auth?shop=${encodeURIComponent(shop)}`);
      }
    }

    // Check for OAuth validation failures (like InvalidOAuthError)
    if (
      errorName === 'InvalidOAuthError' ||
      errorMessage.includes('InvalidOAuthError') ||
      errorMessage.includes('validation')
    ) {
      return res.status(403).json({ error: `OAuth callback validation failed: ${errorMessage}` });
    }

    // Generic token exchange/other failure
    return res.status(500).json({ error: `Token exchange failed: ${errorMessage}` });
  }
}
