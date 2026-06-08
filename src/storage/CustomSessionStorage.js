import { Session } from '@shopify/shopify-api';
import { SessionModel } from '../models/Session.js';

/**
 * Custom session storage for Shopify SDK backed by MongoDB / Mongoose.
 */
export class CustomSessionStorage {
  /**
   * Stores the session in MongoDB.
   * @param {Session} session - The Shopify session object.
   * @returns {Promise<boolean>} True if stored successfully.
   * @throws {Error} Propagates any MongoDB error.
   */
  async storeSession(session) {
    const sessionData = {
      id: session.id,
      shop: session.shop,
      state: session.state,
      isOnline: session.isOnline,
      scope: session.scope,
      expires: session.expires ? new Date(session.expires) : undefined,
      accessToken: session.accessToken,
      onlineAccessInfo: session.onlineAccessInfo
    };

    await SessionModel.findOneAndUpdate(
      { id: session.id },
      sessionData,
      { upsert: true, new: true }
    );
    return true;
  }

  /**
   * Loads a session from MongoDB.
   * @param {string} id - The session ID.
   * @returns {Promise<Session | undefined>} The Shopify session or undefined.
   * @throws {Error} Propagates any MongoDB error.
   */
  async loadSession(id) {
    const doc = await SessionModel.findOne({ id });
    if (!doc) {
      return undefined;
    }

    // Explicitly hydrate native JS Date object for expires
    const expires = doc.expires ? new Date(doc.expires) : undefined;

    return new Session({
      id: doc.id,
      shop: doc.shop,
      state: doc.state,
      isOnline: doc.isOnline,
      scope: doc.scope,
      expires: expires,
      accessToken: doc.accessToken,
      onlineAccessInfo: doc.onlineAccessInfo
    });
  }

  /**
   * Deletes a session from MongoDB.
   * @param {string} id - The session ID.
   * @returns {Promise<boolean>} True if deleted successfully.
   * @throws {Error} Propagates any MongoDB error.
   */
  async deleteSession(id) {
    await SessionModel.deleteOne({ id });
    return true;
  }
}
