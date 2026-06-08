import crypto from 'crypto';

/**
 * Middleware to validate the HMAC signature on incoming requests from Shopify.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 */
export function validateHmac(req, res, next) {
  const { hmac, ...params } = req.query;

  if (!hmac) {
    return res.status(401).json({ error: 'Missing HMAC' });
  }

  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Shopify API secret is not configured' });
  }

  // 1. Sort keys alphabetically
  // 2. Format array values as comma-separated strings (no spaces)
  // 3. Construct message string: key1=val1&key2=val2&...
  const message = Object.keys(params)
    .sort()
    .map(key => {
      const val = params[key];
      const valStr = Array.isArray(val) ? val.join(',') : String(val);
      return `${key}=${valStr}`;
    })
    .join('&');

  try {
    const computedHmac = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('hex');

    const computedBuffer = Buffer.from(computedHmac, 'hex');
    const providedBuffer = Buffer.from(hmac, 'hex');

    // timingSafeEqual requires buffers of identical length
    if (computedBuffer.length !== providedBuffer.length) {
      return res.status(401).json({ error: 'Invalid HMAC signature' });
    }

    if (!crypto.timingSafeEqual(computedBuffer, providedBuffer)) {
      return res.status(401).json({ error: 'Invalid HMAC signature' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid HMAC signature' });
  }
}
