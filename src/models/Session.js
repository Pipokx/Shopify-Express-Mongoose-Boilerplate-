import mongoose from 'mongoose';
import { encrypt, decrypt } from '../utils/encryption.js';

const SessionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true
    },
    shop: {
      type: String,
      required: true,
      index: true
    },
    state: {
      type: String
    },
    isOnline: {
      type: Boolean,
      default: false
    },
    scope: {
      type: String
    },
    expires: {
      type: Date,
      index: { expires: 0 }
    },
    accessToken: {
      type: String,
      set: (val) => {
        if (!val) return val;
        const key = process.env.ENCRYPTION_KEY;
        if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) {
          throw new Error('ENCRYPTION_KEY must be configured as a 64-character hex string.');
        }
        return encrypt(val, key);
      },
      get: (val) => {
        if (!val) return val;
        const key = process.env.ENCRYPTION_KEY;
        if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) {
          throw new Error('ENCRYPTION_KEY must be configured as a 64-character hex string.');
        }
        return decrypt(val, key);
      }
    },
    onlineAccessInfo: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true }
  }
);

export const SessionModel = mongoose.model('Session', SessionSchema);

