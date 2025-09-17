const express = require('express');
const { body, validationResult } = require('express-validator');
const { getDB } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const recommendationEngine = require('../services/recommendationEngine');

const router = express.Router();

// Save content item
router.post('/save', authenticateToken, [
  body('item_id').notEmpty(),
  body('item_type').isIn(['opportunity', 'event', 'job', 'resource']),
  body('notes').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { item_id, item_type, notes } = req.body;
    const userId = req.user.id;
    const db = getDB();

    // Check if already saved
    const existing = await db.collection('saved_items').findOne({
      user_id: userId,
      item_id: item_id,
      item_type: item_type
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Item already saved'
      });
    }

    // Save item
    const savedItem = {
      user_id: userId,
      item_id: item_id,
      item_type: item_type,
      notes: notes || '',
      saved_at: new Date()
    };

    await db.collection('saved_items').insertOne(savedItem);

    // Increment save count on content
    const collectionName = `${item_type}s`;
    await db.collection(collectionName).updateOne(
      { _id: item_id },
      { $inc: { saves_count: 1 } }
    );

    // Update user preferences for recommendations
    const content = await db.collection(collectionName).findOne({ _id: item_id });
    if (content) {
      await recommendationEngine.updatePreferencesFromEngagement(
        userId, 
        'save', 
        content
      );
    }

    res.status(201).json({
      success: true,
      message: 'Item saved successfully',
      data: savedItem
    });

  } catch (error) {
    console.error('Save item error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save item'
    });
  }
});

// Remove saved item
router.delete('/save/:item_id/:item_type', authenticateToken, async (req, res) => {
  try {
    const { item_id, item_type } = req.params;
    const userId = req.user.id;
    const db = getDB();

    // Remove saved item
    const result = await db.collection('saved_items').deleteOne({
      user_id: userId,
      item_id: item_id,
      item_type: item_type
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Saved item not found'
      });
    }

    // Decrement save count on content
    const collectionName = `${item_type}s`;
    await db.collection(collectionName).updateOne(
      { _id: item_id },
      { $inc: { saves_count: -1 } }
    );

    res.json({
      success: true,
      message: 'Item removed from saved items'
    });

  } catch (error) {
    console.error('Remove saved item error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove saved item'
    });
  }
});

// Get saved items
router.get('/saved', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const db = getDB();

    const savedItems = await db.collection('saved_items')
      .find({ user_id: userId })
      .sort({ saved_at: -1 })
      .toArray();

    // Get full content for each saved item
    const contentWithDetails = await Promise.all(
      savedItems.map(async (item) => {
        const collectionName = `${item.item_type}s`;
        const content = await db.collection(collectionName).findOne({ 
          _id: item.item_id,
          status: 'active'
        });
        
        return {
          ...item,
          content: content ? {
            ...content,
            content_type: item.item_type
          } : null
        };
      })
    );

    // Filter out items where content was deleted
    const validSavedItems = contentWithDetails.filter(item => item.content !== null);

    res.json({
      success: true,
      data: validSavedItems
    });

  } catch (error) {
    console.error('Get saved items error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get saved items'
    });
  }
});

// Like content item
router.post('/like', authenticateToken, [
  body('item_id').notEmpty(),
  body('item_type').isIn(['opportunity', 'event', 'job', 'resource'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { item_id, item_type } = req.body;
    const userId = req.user.id;
    const db = getDB();

    // Check if already liked
    const existing = await db.collection('likes').findOne({
      user_id: userId,
      item_id: item_id,
      item_type: item_type
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Item already liked'
      });
    }

    // Like item
    const like = {
      user_id: userId,
      item_id: item_id,
      item_type: item_type,
      liked_at: new Date()
    };

    await db.collection('likes').insertOne(like);

    // Increment like count on content
    const collectionName = `${item_type}s`;
    await db.collection(collectionName).updateOne(
      { _id: item_id },
      { $inc: { likes_count: 1 } }
    );

    // Update user preferences for recommendations
    const content = await db.collection(collectionName).findOne({ _id: item_id });
    if (content) {
      await recommendationEngine.updatePreferencesFromEngagement(
        userId, 
        'like', 
        content
      );
    }

    res.status(201).json({
      success: true,
      message: 'Item liked successfully',
      data: like
    });

  } catch (error) {
    console.error('Like item error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to like item'
    });
  }
});

// Unlike content item
router.delete('/like/:item_id/:item_type', authenticateToken, async (req, res) => {
  try {
    const { item_id, item_type } = req.params;
    const userId = req.user.id;
    const db = getDB();

    // Remove like
    const result = await db.collection('likes').deleteOne({
      user_id: userId,
      item_id: item_id,
      item_type: item_type
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Like not found'
      });
    }

    // Decrement like count on content
    const collectionName = `${item_type}s`;
    await db.collection(collectionName).updateOne(
      { _id: item_id },
      { $inc: { likes_count: -1 } }
    );

    res.json({
      success: true,
      message: 'Item unliked successfully'
    });

  } catch (error) {
    console.error('Unlike item error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unlike item'
    });
  }
});

// Get liked items
router.get('/likes', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const db = getDB();

    const likedItems = await db.collection('likes')
      .find({ user_id: userId })
      .sort({ liked_at: -1 })
      .toArray();

    // Get full content for each liked item
    const contentWithDetails = await Promise.all(
      likedItems.map(async (item) => {
        const collectionName = `${item.item_type}s`;
        const content = await db.collection(collectionName).findOne({ 
          _id: item.item_id,
          status: 'active'
        });
        
        return {
          ...item,
          content: content ? {
            ...content,
            content_type: item.item_type
          } : null
        };
      })
    );

    // Filter out items where content was deleted
    const validLikedItems = contentWithDetails.filter(item => item.content !== null);

    res.json({
      success: true,
      data: validLikedItems
    });

  } catch (error) {
    console.error('Get liked items error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get liked items'
    });
  }
});

// Track click-through (external link clicks)
router.post('/click', authenticateToken, [
  body('item_id').notEmpty(),
  body('item_type').isIn(['opportunity', 'event', 'job', 'resource']),
  body('external_url').isURL(),
  body('time_spent').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { item_id, item_type, external_url, time_spent = 0 } = req.body;
    const userId = req.user.id;
    const db = getDB();

    // Record click-through
    const clickThrough = {
      user_id: userId,
      item_id: item_id,
      item_type: item_type,
      external_url: external_url,
      clicked_at: new Date(),
      time_spent_on_page: time_spent,
      user_agent: req.headers['user-agent'] || '',
      referrer_page: req.headers.referer || ''
    };

    await db.collection('click_throughs').insertOne(clickThrough);

    // Update user preferences for recommendations
    const collectionName = `${item_type}s`;
    const content = await db.collection(collectionName).findOne({ _id: item_id });
    if (content) {
      await recommendationEngine.updatePreferencesFromEngagement(
        userId, 
        'click_through', 
        content
      );
    }

    res.json({
      success: true,
      message: 'Click-through tracked successfully'
    });

  } catch (error) {
    console.error('Track click-through error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track click-through'
    });
  }
});

// Get user engagement analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const db = getDB();

    // Get engagement summary
    const [savedCount, likedCount, viewHistory] = await Promise.all([
      db.collection('saved_items').countDocuments({ user_id: userId }),
      db.collection('likes').countDocuments({ user_id: userId }),
      db.collection('user_engagement_history')
        .find({ user_id: userId })
        .sort({ timestamp: -1 })
        .limit(100)
        .toArray()
    ]);

    // Calculate engagement stats
    const engagementStats = {
      total_saved: savedCount,
      total_liked: likedCount,
      total_views: viewHistory.filter(h => h.engagement_type === 'view').length,
      total_click_throughs: viewHistory.filter(h => h.engagement_type === 'click_through').length,
      recent_activity: viewHistory.slice(0, 10)
    };

    res.json({
      success: true,
      data: engagementStats
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get engagement analytics'
    });
  }
});

module.exports = router;

