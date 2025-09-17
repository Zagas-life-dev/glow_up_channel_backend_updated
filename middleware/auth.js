const jwt = require('jsonwebtoken');
const { getDB } = require('../config/database');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: 'Access token required' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database to ensure they still exist
    const db = getDB();
    const user = await db.collection('users').findOne({ 
      _id: decoded.userId,
      status: 'active'
    });

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not found or inactive' 
      });
    }

    req.user = {
      id: user._id,
      email: user.email,
      role: user.role,
      verified: user.verified
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(403).json({ 
      success: false, 
      error: 'Invalid or expired token' 
    });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Insufficient permissions' 
      });
    }

    next();
  };
};

const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDB();
    const user = await db.collection('users').findOne({ 
      _id: decoded.userId,
      status: 'active'
    });

    req.user = user ? {
      id: user._id,
      email: user.email,
      role: user.role,
      verified: user.verified
    } : null;
    
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  optionalAuth
};

