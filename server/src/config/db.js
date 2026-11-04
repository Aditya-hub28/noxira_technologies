const mongoose = require('mongoose');
const env = require('./env');

let mongodInstance = null;

async function connectDB() {
  try {
    let uri = env.MONGODB_URI;

    if (!uri) {
      console.log('⚡ No MONGODB_URI provided in .env. Initializing embedded MongoMemoryServer for development...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongodInstance = await MongoMemoryServer.create();
      uri = mongodInstance.getUri();
      console.log(`✅ Embedded MongoMemoryServer started at: ${uri}`);
    }

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    });

    console.log(`🚀 MongoDB Connected Successfully: ${mongoose.connection.host}`);
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    // If external URI failed in dev, try in-memory fallback
    if (env.NODE_ENV !== 'production' && !mongodInstance) {
      console.log('🔄 Attempting fallback to embedded MongoMemoryServer...');
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongodInstance = await MongoMemoryServer.create();
        const fallbackUri = mongodInstance.getUri();
        await mongoose.connect(fallbackUri);
        console.log(`✅ Fallback MongoMemoryServer connected at: ${fallbackUri}`);
        return;
      } catch (innerErr) {
        console.error('❌ Fallback DB failed:', innerErr.message);
      }
    }
    process.exit(1);
  }
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (mongodInstance) {
    await mongodInstance.stop();
  }
}

module.exports = { connectDB, disconnectDB };
