import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import request from 'supertest';
import { createApp } from './app.js';

vi.mock('./middleware/hmac.js', () => ({
  validateHmac: (req, res, next) => next()
}));

vi.mock('./controllers/OAuthController.js', () => ({
  beginAuth: (req, res) => {
    throw new Error('Something very bad happened');
  },
  handleCallback: (req, res) => {
    res.send('callback');
  },
  handleRoot: (req, res) => {
    res.send('root');
  }
}));

describe('app factory', () => {
  const mockShopify = {};

  it('should parse JSON body correctly', async () => {
    const app = createApp(mockShopify);

    // We can add routes at the end for simple non-error path body testing
    app.post('/test-json', (req, res) => {
      res.json({ received: req.body });
    });

    const response = await request(app)
      .post('/test-json')
      .send({ hello: 'world' })
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: { hello: 'world' } });
  });

  // Feature: shopify-express-mongoose-boilerplate, Property 3: Raw Body Preservation
  it('Property 3: Raw Body Preservation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.object(),
        async (jsonObj) => {
          const app = createApp(mockShopify);
          app.post('/test-raw-body', (req, res) => {
            res.json({ rawBodyStr: req.rawBody ? req.rawBody.toString('utf8') : null });
          });

          const jsonString = JSON.stringify(jsonObj);
          const response = await request(app)
            .post('/test-raw-body')
            .send(jsonString)
            .set('Content-Type', 'application/json');

          expect(response.body.rawBodyStr).toBe(jsonString);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle empty body leaving req.rawBody undefined', async () => {
    const app = createApp(mockShopify);
    app.post('/test-empty-body', (req, res) => {
      res.json({ rawBodyIsUndefined: req.rawBody === undefined });
    });

    const response = await request(app)
      .post('/test-empty-body')
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body.rawBodyIsUndefined).toBe(true);
  });

  it('should limit requests to 30 within a 60s window', async () => {
    const app = createApp(mockShopify);
    let successCount = 0;
    let rateLimitCount = 0;

    for (let i = 0; i < 31; i++) {
      const response = await request(app).get('/');
      // The mocked root returns 'root' and 200 OK
      if (response.status === 200) {
        successCount++;
      } else if (response.status === 429) {
        rateLimitCount++;
      }
    }

    expect(successCount).toBe(30);
    expect(rateLimitCount).toBe(1);
  });

  it('should catch unhandled errors from routes and return 500 without leaking stack traces', async () => {
    const app = createApp(mockShopify);

    // Suppress console.error in tests to avoid cluttering output
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Hits GET /api/auth which triggers the mocked beginAuth that throws
    const response = await request(app)
      .get('/api/auth');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal server error' });
    expect(response.text).not.toContain('Something very bad happened');
    expect(response.text).not.toContain('stack');

    consoleErrorSpy.mockRestore();
  });
});
