const { getDB } = require('../config/database');

class RecommendationEngine {
  constructor() {
    this.decayRate = 0.1; // Time decay rate for popularity
    this.exploreFactor = 0.05; // 5% of feed for exploration
  }

  // Main recommendation function
  async getRecommendations(userId, contentType = 'all', limit = 20) {
    try {
      const db = getDB();
      
      // Get user preferences
      const userProfile = await db.collection('user_profiles').findOne({ user_id: userId });
      const userPreferences = await db.collection('user_preferences').findOne({ user_id: userId });
      
      if (!userProfile && !userPreferences) {
        // Cold start - return popular content
        return await this.getColdStartRecommendations(contentType, limit);
      }

      // Get all active content
      const content = await this.getActiveContent(contentType);
      
      // Calculate scores for each item
      const scoredContent = await Promise.all(
        content.map(item => this.calculateScore(item, userProfile, userPreferences))
      );

      // Sort by score and return top recommendations
      return scoredContent
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => ({
          ...item,
          score: undefined // Remove score from final output
        }));

    } catch (error) {
      console.error('Recommendation error:', error);
      return [];
    }
  }

  // Calculate hybrid score for content item
  async calculateScore(item, userProfile, userPreferences) {
    const scores = {
      interestMatch: 0,
      skillMatch: 0,
      locationMatch: 0,
      popularity: 0,
      recency: 0,
      explore: 0
    };

    // 70% Personalization (User-Based)
    if (userProfile || userPreferences) {
      // Interest Matching (40% weight)
      scores.interestMatch = this.calculateInterestMatch(item, userProfile, userPreferences);
      
      // Skill Matching (25% weight) 
      scores.skillMatch = this.calculateSkillMatch(item, userProfile, userPreferences);
      
      // Location Matching (5% weight)
      scores.locationMatch = this.calculateLocationMatch(item, userProfile, userPreferences);
    }

    // 30% Community Signals (Content-Based)
    // Popularity with Time Decay (15% weight)
    scores.popularity = this.calculateDecayedPopularity(item);
    
    // Recency (10% weight)
    scores.recency = this.calculateRecency(item);
    
    // Explore Factor (5% weight)
    scores.explore = this.calculateExploreFactor(item);

    // Final weighted score
    const totalScore = 
      (scores.interestMatch * 0.4) +
      (scores.skillMatch * 0.25) +
      (scores.locationMatch * 0.05) +
      (scores.popularity * 0.15) +
      (scores.recency * 0.1) +
      (scores.explore * 0.05);

    return {
      ...item,
      score: totalScore,
      scoreBreakdown: scores
    };
  }

  // Interest matching (40% weight)
  calculateInterestMatch(item, userProfile, userPreferences) {
    const userInterests = userProfile?.interests || userPreferences?.interests || [];
    const itemTags = item.tags || [];
    
    if (userInterests.length === 0 || itemTags.length === 0) {
      return 0;
    }

    const matchedInterests = itemTags.filter(tag => 
      userInterests.some(interest => 
        interest.toLowerCase().includes(tag.toLowerCase()) ||
        tag.toLowerCase().includes(interest.toLowerCase())
      )
    );

    return (matchedInterests.length / userInterests.length) * 100;
  }

  // Skill matching (25% weight) - partial matching for stretch opportunities
  calculateSkillMatch(item, userProfile, userPreferences) {
    const userSkills = userProfile?.skills || userPreferences?.skills || [];
    const itemRequirements = item.requirements || [];
    
    if (userSkills.length === 0 || itemRequirements.length === 0) {
      return 0;
    }

    const matchedSkills = itemRequirements.filter(req => 
      userSkills.some(skill => 
        skill.toLowerCase().includes(req.toLowerCase()) ||
        req.toLowerCase().includes(skill.toLowerCase())
      )
    );

    // Partial matching - even if not all skills match, give some score
    return (matchedSkills.length / itemRequirements.length) * 100;
  }

  // Location matching (5% weight)
  calculateLocationMatch(item, userProfile, userPreferences) {
    const userLocation = userProfile?.location_data || userPreferences?.location_data || {};
    const itemLocation = item.location || '';
    
    // If no user location data, return neutral score
    if (!userLocation.country && !userLocation.province && !userLocation.city) {
      return 50; // Neutral score for unknown location
    }

    // Remote opportunities get full score
    if (itemLocation.toLowerCase().includes('remote') || 
        itemLocation.toLowerCase().includes('virtual') ||
        itemLocation.toLowerCase().includes('online')) {
      return 100;
    }

    // Exact location matches get highest score
    if (userLocation.city && itemLocation.toLowerCase().includes(userLocation.city.toLowerCase())) {
      return 100;
    }

    // Province/state matches get good score
    if (userLocation.province && itemLocation.toLowerCase().includes(userLocation.province.toLowerCase())) {
      return 80;
    }

    // Country matches get moderate score
    if (userLocation.country && itemLocation.toLowerCase().includes(userLocation.country.toLowerCase())) {
      return 60;
    }

    // No location match
    return 20;
  }

  // Decayed popularity (15% weight)
  calculateDecayedPopularity(item) {
    const likes = item.likes_count || 0;
    const saves = item.saves_count || 0;
    const views = item.views || 0;
    
    const popularity = likes + saves + views;
    
    // Time decay
    const ageInDays = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const decayedPopularity = popularity / (1 + ageInDays * this.decayRate);
    
    // Normalize to 0-100 scale
    return Math.min(decayedPopularity / 10, 100);
  }

  // Recency score (10% weight)
  calculateRecency(item) {
    const ageInDays = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24);
    
    // Fresh content gets higher score
    if (ageInDays <= 1) return 100;
    if (ageInDays <= 7) return 80;
    if (ageInDays <= 30) return 60;
    if (ageInDays <= 90) return 40;
    
    return 20; // Older content gets lower score
  }

  // Explore factor (5% weight) - random boost for discovery
  calculateExploreFactor(item) {
    // Random factor to encourage exploration
    return Math.random() * 100;
  }

  // Get active content from database
  async getActiveContent(contentType) {
    const db = getDB();
    const collections = [];
    
    if (contentType === 'all' || contentType === 'opportunity') {
      const opportunities = await db.collection('opportunities')
        .find({ status: 'active' })
        .toArray();
      collections.push(...opportunities.map(item => ({ ...item, type: 'opportunity' })));
    }
    
    if (contentType === 'all' || contentType === 'event') {
      const events = await db.collection('events')
        .find({ status: 'active' })
        .toArray();
      collections.push(...events.map(item => ({ ...item, type: 'event' })));
    }
    
    if (contentType === 'all' || contentType === 'job') {
      const jobs = await db.collection('jobs')
        .find({ status: 'active' })
        .toArray();
      collections.push(...jobs.map(item => ({ ...item, type: 'job' })));
    }
    
    if (contentType === 'all' || contentType === 'resource') {
      const resources = await db.collection('resources')
        .find({ status: 'active' })
        .toArray();
      collections.push(...resources.map(item => ({ ...item, type: 'resource' })));
    }
    
    return collections;
  }

  // Cold start recommendations for new users
  async getColdStartRecommendations(contentType, limit) {
    const db = getDB();
    const content = await this.getActiveContent(contentType);
    
    // Sort by popularity and recency for new users
    return content
      .map(item => ({
        ...item,
        score: (item.likes_count || 0) + (item.saves_count || 0) + (item.views || 0)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => ({
        ...item,
        score: undefined
      }));
  }

  // Update user preferences based on engagement
  async updatePreferencesFromEngagement(userId, engagementType, itemData) {
    try {
      const db = getDB();
      
      // Get current preferences
      const preferences = await db.collection('user_preferences').findOne({ user_id: userId });
      
      if (!preferences) return;

      // Learn from saves and likes
      if (engagementType === 'save' || engagementType === 'like') {
        const tags = itemData.tags || [];
        const requirements = itemData.requirements || [];
        
        // Update interests based on tags
        const currentInterests = preferences.interests || {};
        tags.forEach(tag => {
          currentInterests[tag] = (currentInterests[tag] || 0) + 1;
        });
        
        // Update skills based on requirements
        const currentSkills = preferences.skills || {};
        requirements.forEach(req => {
          currentSkills[req] = (currentSkills[req] || 0) + 1;
        });
        
        // Update preferences
        await db.collection('user_preferences').updateOne(
          { user_id: userId },
          { 
            $set: { 
              interests: currentInterests,
              skills: currentSkills,
              updated_at: new Date()
            }
          }
        );
      }
      
      // Learn from click-throughs (lower weight)
      if (engagementType === 'click_through') {
        const tags = itemData.tags || [];
        const currentInterests = preferences.interests || {};
        
        tags.forEach(tag => {
          currentInterests[tag] = (currentInterests[tag] || 0) + 0.5;
        });
        
        await db.collection('user_preferences').updateOne(
          { user_id: userId },
          { 
            $set: { 
              interests: currentInterests,
              updated_at: new Date()
            }
          }
        );
      }
      
    } catch (error) {
      console.error('Error updating preferences from engagement:', error);
    }
  }
}

module.exports = new RecommendationEngine();
