import express from 'express';
import { beginAuth, handleCallback } from '../controllers/OAuthController.js';
import { validateHmac } from '../middleware/hmac.js';

const router = express.Router();

// Route to initiate OAuth flow, protected by HMAC validation
router.get('/api/auth', validateHmac, beginAuth);

// Route to handle OAuth callback redirect from Shopify
router.get('/api/auth/callback', handleCallback);

export const authRouter = router;
export default router;
