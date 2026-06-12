import mongoose from 'mongoose';

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
      type: String
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

