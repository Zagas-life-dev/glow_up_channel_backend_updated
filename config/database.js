const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://admin_db_user:QpAHY8MwWdvHfx0u@glowup-channel.vhcmgft.mongodb.net/?retryWrites=true&w=majority&appName=glowup-channel';

let client;
let db;

const connectDB = async () => {
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db('glowup_channel');
    console.log('✅ Connected to MongoDB Atlas');
    
    // Create indexes for better performance
    await createIndexes();
    
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const createIndexes = async () => {
  try {
    // Users collection indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ role: 1 });
    
    // User profiles indexes
    await db.collection('user_profiles').createIndex({ user_id: 1 }, { unique: true });
    await db.collection('user_profiles').createIndex({ interests: 1 });
    await db.collection('user_profiles').createIndex({ skills: 1 });
    await db.collection('user_profiles').createIndex({ location_data: 1 });
    
    // Content collections indexes
    const contentCollections = ['opportunities', 'events', 'jobs', 'resources'];
    
    for (const collection of contentCollections) {
      await db.collection(collection).createIndex({ status: 1 });
      await db.collection(collection).createIndex({ created_at: -1 });
      await db.collection(collection).createIndex({ tags: 1 });
      await db.collection(collection).createIndex({ provider_id: 1 });
      await db.collection(collection).createIndex({ title: 'text', description: 'text' });
      await db.collection(collection).createIndex({ is_featured: 1 });
      await db.collection(collection).createIndex({ is_promoted: 1 });
      await db.collection(collection).createIndex({ location: 1 });
    }
    
    // Engagement indexes
    await db.collection('saved_items').createIndex({ user_id: 1, item_type: 1 });
    await db.collection('likes').createIndex({ user_id: 1, item_type: 1 });
    await db.collection('user_engagement_history').createIndex({ user_id: 1, timestamp: -1 });
    await db.collection('user_engagement_history').createIndex({ item_id: 1, item_type: 1 });
    
    console.log('✅ Database indexes created');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  }
};

const getDB = () => {
  if (!db) {
    throw new Error('Database not connected. Call connectDB() first.');
  }
  return db;
};

const closeDB = async () => {
  if (client) {
    await client.close();
    console.log('✅ MongoDB connection closed');
  }
};

module.exports = {
  connectDB,
  getDB,
  closeDB
};
