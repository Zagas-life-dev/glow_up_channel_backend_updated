const bcrypt = require('bcryptjs');
const { getDB } = require('../config/database');

class User {
  constructor(data) {
    this.email = data.email;
    this.password = data.password;
    this.name = data.name;
    this.role = data.role || 'seeker';
    this.verified = data.verified || false;
    this.status = data.status || 'active';
    this.created_at = new Date();
    this.updated_at = new Date();
  }

  async save() {
    const db = getDB();
    
    // Hash password before saving
    if (this.password) {
      this.password = await bcrypt.hash(this.password, 12);
    }

    const result = await db.collection('users').insertOne(this);
    return result.insertedId;
  }

  static async findByEmail(email) {
    const db = getDB();
    return await db.collection('users').findOne({ email });
  }

  static async findById(id) {
    const db = getDB();
    return await db.collection('users').findOne({ _id: id });
  }

  static async updateById(id, updateData) {
    const db = getDB();
    updateData.updated_at = new Date();
    
    return await db.collection('users').updateOne(
      { _id: id },
      { $set: updateData }
    );
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  static async createUserProfile(userId, profileData) {
    const db = getDB();
    
    const profile = {
      user_id: userId,
      ...profileData,
      onboarding_completed: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    return await db.collection('user_profiles').insertOne(profile);
  }

  static async getUserProfile(userId) {
    const db = getDB();
    return await db.collection('user_profiles').findOne({ user_id: userId });
  }

  static async updateUserProfile(userId, updateData) {
    const db = getDB();
    updateData.updated_at = new Date();
    
    return await db.collection('user_profiles').updateOne(
      { user_id: userId },
      { $set: updateData }
    );
  }

  static async getUserPreferences(userId) {
    const db = getDB();
    return await db.collection('user_preferences').findOne({ user_id: userId });
  }

  static async updateUserPreferences(userId, preferences) {
    const db = getDB();
    
    const result = await db.collection('user_preferences').updateOne(
      { user_id: userId },
      { 
        $set: {
          ...preferences,
          updated_at: new Date()
        }
      },
      { upsert: true }
    );

    return result;
  }
}

module.exports = User;

