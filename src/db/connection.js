import mongoose from 'mongoose';

const defaultOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4
};

/**
 * Connects to MongoDB using Mongoose.
 * @param {string} uri - The connection URI.
 * @param {mongoose.ConnectOptions} [options] - Connection options override.
 * @returns {Promise<typeof mongoose>} Resolves with mongoose on success, rejects with error on failure.
 */
export async function connectDB(uri, options = {}) {
  const mergedOptions = { ...defaultOptions, ...options };
  return await mongoose.connect(uri, mergedOptions);
}

/**
 * Disconnects from MongoDB.
 * @returns {Promise<void>} Resolves when disconnected.
 */
export async function disconnectDB() {
  await mongoose.disconnect();
}
