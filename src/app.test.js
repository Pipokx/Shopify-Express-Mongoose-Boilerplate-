import { describe, it, expect, vi } from 'vitest';
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

  it('should parse URL-encoded body correctly', async () => {
    const app = createApp(mockShopify);

    app.post('/test-urlencoded', (req, res) => {
      res.json({ received: req.body });
    });

    const response = await request(app)
      .post('/test-urlencoded')
      .send('hello=world&foo=bar')
      .set('Content-Type', 'application/x-www-form-urlencoded');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: { hello: 'world', foo: 'bar' } });
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
