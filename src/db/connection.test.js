import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from './connection.js';

vi.mock('mongoose', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      ...actual.default,
      connect: vi.fn(),
      disconnect: vi.fn()
    }
  };
});

describe('db/connection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call mongoose.connect with correct URI and merged options on success', async () => {
    const mockMongoose = {};
    mongoose.connect.mockResolvedValue(mockMongoose);

    const uri = 'mongodb://localhost:27017/test';
    const customOptions = { maxPoolSize: 50 };

    await expect(connectDB(uri, customOptions)).resolves.toBe(mockMongoose);

    expect(mongoose.connect).toHaveBeenCalledWith(uri, {
      maxPoolSize: 50,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4
    });
  });

  it('should propagate the error when mongoose.connect rejects', async () => {
    const mockError = new Error('Connection failed');
    mongoose.connect.mockRejectedValue(mockError);

    const uri = 'mongodb://localhost:27017/test';

    await expect(connectDB(uri)).rejects.toThrow('Connection failed');
  });

  it('should call mongoose.disconnect when disconnectDB is called', async () => {
    mongoose.disconnect.mockResolvedValue();

    await disconnectDB();

    expect(mongoose.disconnect).toHaveBeenCalled();
  });
});
