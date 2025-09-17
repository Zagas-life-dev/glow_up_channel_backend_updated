const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { getDB } = require('../config/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Get all content (opportunities, events, jobs, resources)
router.get('/', [
  query('type').optional().isIn(['opportunity', 'event', 'job', 'resource']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('tags').optional().isString(),
  query('location').optional().isString()
], optionalAuth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const db = getDB();
    const {
      type = 'all',
      page = 1,
      limit = 20,
      search,
      tags,
      location
    } = req.query;

    const skip = (page - 1) * limit;
    const collections = [];
    
    // Determine which collections to query
    if (type === 'all' || type === 'opportunity') {
      collections.push('opportunities');
    }
    if (type === 'all' || type === 'event') {
      collections.push('events');
    }
    if (type === 'all' || type === 'job') {
      collections.push('jobs');
    }
    if (type === 'all' || type === 'resource') {
      collections.push('resources');
    }

    let allContent = [];

    // Query each collection
    for (const collectionName of collections) {
      let query = { status: 'active' };

      // Add search filter
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      // Add tags filter
      if (tags) {
        const tagArray = tags.split(',').map(tag => tag.trim());
        query.tags = { $in: tagArray };
      }

      // Add location filter
      if (location) {
        query.$or = [
          { location: { $regex: location, $options: 'i' } },
          { 'location_data.city': { $regex: location, $options: 'i' } },
          { 'location_data.province': { $regex: location, $options: 'i' } }
        ];
      }

      const content = await db.collection(collectionName)
        .find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();

      // Add type to each item
      allContent.push(...content.map(item => ({
        ...item,
        content_type: collectionName.slice(0, -1) // Remove 's' from collection name
      })));
    }

    // Sort all content by creation date
    allContent.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Track view if user is authenticated
    if (req.user) {
      // Track view for analytics
      await trackEngagement(req.user.id, null, 'search', {
        search_query: search,
        filters: { type, tags, location },
        results_count: allContent.length
      });
    }

    res.json({
      success: true,
      data: allContent,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: allContent.length,
        hasMore: allContent.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get content error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch content'
    });
  }
});

// Get single content item
router.get('/:type/:id', optionalAuth, async (req, res) => {
  try {
    const { type, id } = req.params;
    const db = getDB();
    
    const collectionName = `${type}s`; // Convert singular to plural
    const item = await db.collection(collectionName).findOne({ 
      _id: id, 
      status: 'active' 
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Content not found'
      });
    }

    // Increment view count
    await db.collection(collectionName).updateOne(
      { _id: id },
      { $inc: { views: 1 } }
    );

    // Track view if user is authenticated
    if (req.user) {
      await trackEngagement(req.user.id, id, 'view', {
        content_type: type,
        time_spent: 0 // Will be updated by frontend
      });
    }

    res.json({
      success: true,
      data: {
        ...item,
        content_type: type
      }
    });

  } catch (error) {
    console.error('Get content item error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch content item'
    });
  }
});

// Create new content (authenticated users only)
router.post('/:type', authenticateToken, [
  body('title').trim().isLength({ min: 5, max: 200 }),
  body('description').trim().isLength({ min: 20, max: 2000 }),
  body('tags').optional().isArray(),
  body('location').optional().isString(),
  body('external_url').optional().isURL()
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
    const db = getDB();
    
    const collectionName = `${type}s`;
    const contentData = {
      ...req.body,
      provider_id: req.user.id,
      status: 'active',
      views: 0,
      likes_count: 0,
      saves_count: 0,
      is_featured: false,
      is_promoted: false,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await db.collection(collectionName).insertOne(contentData);

    res.status(201).json({
      success: true,
      message: 'Content created successfully',
      data: {
        id: result.insertedId,
        ...contentData
      }
    });

  } catch (error) {
    console.error('Create content error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create content'
    });
  }
});

// Update content (only by owner)
router.put('/:type/:id', authenticateToken, async (req, res) => {
  try {
    const { type, id } = req.params;
    const db = getDB();
    
    const collectionName = `${type}s`;
    
    // Check if user owns this content
    const existingItem = await db.collection(collectionName).findOne({ 
      _id: id,
      provider_id: req.user.id
    });

    if (!existingItem) {
      return res.status(404).json({
        success: false,
        error: 'Content not found or access denied'
      });
    }

    const updateData = {
      ...req.body,
      updated_at: new Date()
    };

    await db.collection(collectionName).updateOne(
      { _id: id },
      { $set: updateData }
    );

    res.json({
      success: true,
      message: 'Content updated successfully'
    });

  } catch (error) {
    console.error('Update content error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update content'
    });
  }
});

// Delete content (only by owner)
router.delete('/:type/:id', authenticateToken, async (req, res) => {
  try {
    const { type, id } = req.params;
    const db = getDB();
    
    const collectionName = `${type}s`;
    
    // Check if user owns this content
    const existingItem = await db.collection(collectionName).findOne({ 
      _id: id,
      provider_id: req.user.id
    });

    if (!existingItem) {
      return res.status(404).json({
        success: false,
        error: 'Content not found or access denied'
      });
    }

    // Soft delete - set status to deleted
    await db.collection(collectionName).updateOne(
      { _id: id },
      { $set: { status: 'deleted', updated_at: new Date() } }
    );

    res.json({
      success: true,
      message: 'Content deleted successfully'
    });

  } catch (error) {
    console.error('Delete content error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete content'
    });
  }
});

// Helper function to track engagement
async function trackEngagement(userId, itemId, engagementType, data) {
  try {
    const db = getDB();
    
    await db.collection('user_engagement_history').insertOne({
      user_id: userId,
      item_id: itemId,
      item_type: data.content_type || 'unknown',
      engagement_type: engagementType,
      engagement_data: data,
      timestamp: new Date(),
      user_agent: data.user_agent || '',
      time_spent_on_page: data.time_spent || 0
    });
  } catch (error) {
    console.error('Error tracking engagement:', error);
  }
}

module.exports = router;
