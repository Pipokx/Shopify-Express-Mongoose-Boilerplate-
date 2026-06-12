import { getShopify } from '../config/shopify.js';

/**
 * Middleware to validate a Shopify App Bridge session token (JWT).
 * Extracts the Bearer token from the Authorization header and verifies it using the Shopify SDK.
 * 
 * @example
 * // In a route definition:
 * import { validateSessionToken } from '../middleware/validateSessionToken.js';
 * 
 * router.get('/api/protected', validateSessionToken, (req, res) => {
 *   res.json({ shop: req.sessionToken.dest });
 * });
 * 
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 */
export async function validateSessionToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const matches = authHeader.match(/^Bearer (.+)$/);
  if (!matches) {
    return res.status(401).json({ error: 'Malformed Authorization header' });
  }

  const token = matches[1];
  const shopify = getShopify();

  try {
    const payload = await shopify.session.decodeSessionToken(token);
    req.sessionToken = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid session token' });
  }
}
