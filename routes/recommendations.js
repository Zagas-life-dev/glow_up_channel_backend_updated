const express = require('express');
const { query, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const recommendationEngine = require('../services/recommendationEngine');

const router = express.Router();

// Get personalized recommendations
router.get('/', authenticateToken, [
  query('type').optional().isIn(['opportunity', 'event', 'job', 'resource', 'all']),
  query('limit').optional().isInt({ min: 1, max: 100 })
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

    const { type = 'all', limit = 20 } = req.query;
    const userId = req.user.id;

    const recommendations = await recommendationEngine.getRecommendations(
      userId,
      type,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: recommendations,
      meta: {
        type,
        limit: parseInt(limit),
        count: recommendations.length
      }
    });

  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recommendations'
    });
  }
});

// Get recommendations for specific content type
router.get('/:type', authenticateToken, [
  query('limit').optional().isInt({ min: 1, max: 100 })
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

    const { type } = req.params;
    const { limit = 20 } = req.query;
    const userId = req.user.id;

    // Validate content type
    if (!['opportunity', 'event', 'job', 'resource'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid content type'
      });
    }

    const recommendations = await recommendationEngine.getRecommendations(
      userId,
      type,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: recommendations,
      meta: {
        type,
        limit: parseInt(limit),
        count: recommendations.length
      }
    });

  } catch (error) {
    console.error('Get type recommendations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recommendations'
    });
  }
});

// Get trending content (popular content across all types)
router.get('/trending/global', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const recommendations = await recommendationEngine.getColdStartRecommendations(
      'all',
      parseInt(limit)
    );

    res.json({
      success: true,
      data: recommendations,
      meta: {
        type: 'trending',
        limit: parseInt(limit),
        count: recommendations.length
      }
    });

  } catch (error) {
    console.error('Get trending content error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trending content'
    });
  }
});

// Get trending content for specific type
router.get('/trending/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { limit = 20 } = req.query;

    // Validate content type
    if (!['opportunity', 'event', 'job', 'resource'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid content type'
      });
    }

    const recommendations = await recommendationEngine.getColdStartRecommendations(
      type,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: recommendations,
      meta: {
        type: `trending_${type}`,
        limit: parseInt(limit),
        count: recommendations.length
      }
    });

  } catch (error) {
    console.error('Get trending type content error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trending content'
    });
  }
});

// Get similar content based on a specific item
router.get('/similar/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { limit = 10 } = req.query;

    // Validate content type
    if (!['opportunity', 'event', 'job', 'resource'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid content type'
      });
    }

    const { getDB } = require('../config/database');
    const db = getDB();
    const collectionName = `${type}s`;

    // Get the reference item
    const referenceItem = await db.collection(collectionName).findOne({ 
      _id: id, 
      status: 'active' 
    });

    if (!referenceItem) {
      return res.status(404).json({
        success: false,
        error: 'Reference item not found'
      });
    }

    // Find similar items based on tags and category
    const similarItems = await db.collection(collectionName)
      .find({
        _id: { $ne: id },
        status: 'active',
        $or: [
          { tags: { $in: referenceItem.tags || [] } },
          { category: referenceItem.category },
          { type: referenceItem.type }
        ]
      })
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .toArray();

    res.json({
      success: true,
      data: similarItems.map(item => ({
        ...item,
        content_type: type
      })),
      meta: {
        type: `similar_${type}`,
        reference_id: id,
        limit: parseInt(limit),
        count: similarItems.length
      }
    });

  } catch (error) {
    console.error('Get similar content error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get similar content'
    });
  }
});

// Get user's personalized feed (mix of all content types)
router.get('/feed/personalized', authenticateToken, [
  query('limit').optional().isInt({ min: 1, max: 100 })
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

    const { limit = 30 } = req.query;
    const userId = req.user.id;

    // Get recommendations for all content types
    const recommendations = await recommendationEngine.getRecommendations(
      userId,
      'all',
      parseInt(limit)
    );

    // Mix content types in the feed
    const mixedFeed = recommendations.sort(() => Math.random() - 0.5);

    res.json({
      success: true,
      data: mixedFeed,
      meta: {
        type: 'personalized_feed',
        limit: parseInt(limit),
        count: mixedFeed.length
      }
    });

  } catch (error) {
    console.error('Get personalized feed error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get personalized feed'
    });
  }
});

module.exports = router;

