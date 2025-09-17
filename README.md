# Glow Up Channel Backend API

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB Atlas account
- Git

### Setup

1. **Install Dependencies**
```bash
cd backend
npm install
```

2. **Environment Configuration**
```bash
cp .env.example .env
```

Edit `.env` file with your configuration:
```env
# MongoDB Atlas Connection (already configured)
MONGODB_URI=mongodb+srv://admin_db_user:QpAHY8MwWdvHfx0u@glowup-channel.vhcmgft.mongodb.net/?retryWrites=true&w=majority&appName=glowup-channel

# JWT Secret (generate a secure random string)
JWT_SECRET=your-super-secret-jwt-key-here

# Server Configuration
PORT=5000
NODE_ENV=development

# CORS Configuration
FRONTEND_URL=http://localhost:3000
```

3. **Start Development Server**
```bash
npm run dev
```

The API will be available at `http://localhost:5000`

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/onboarding` - Save onboarding data
- `GET /api/auth/profile` - Get user profile

### Content Management
- `GET /api/content` - Get all content (with filters)
- `GET /api/content/:type/:id` - Get specific content item
- `POST /api/content/:type` - Create new content
- `PUT /api/content/:type/:id` - Update content
- `DELETE /api/content/:type/:id` - Delete content

### User Engagement
- `POST /api/engagement/save` - Save content item
- `DELETE /api/engagement/save/:item_id/:item_type` - Remove saved item
- `GET /api/engagement/saved` - Get saved items
- `POST /api/engagement/like` - Like content item
- `DELETE /api/engagement/like/:item_id/:item_type` - Unlike content item
- `GET /api/engagement/likes` - Get liked items
- `POST /api/engagement/click` - Track click-through

### Recommendations
- `GET /api/recommendations` - Get personalized recommendations
- `GET /api/recommendations/:type` - Get type-specific recommendations
- `GET /api/recommendations/trending/global` - Get trending content
- `GET /api/recommendations/feed/personalized` - Get personalized feed

## 🧠 Recommendation Algorithm

The system uses a hybrid recommendation algorithm:

### 70% Personalization (User-Based)
- **Interest Matching (40%)**: Matches user interests with content tags
- **Skill Matching (25%)**: Partial skill matching for stretch opportunities

### 30% Community Signals (Content-Based)
- **Popularity with Time Decay (15%)**: Engagement score with time decay
- **Recency (10%)**: Fresh content gets priority
- **Explore Factor (5%)**: Random discovery for new content

### Real-Time Learning
- System learns from user saves, likes, and click-throughs
- Preferences update automatically based on engagement
- Prevents echo chambers with exploration factor

## 🗄️ Database Schema

### Collections
- `users` - User accounts and authentication
- `user_profiles` - Detailed user profiles and onboarding data
- `user_preferences` - Dynamic user preferences for recommendations
- `opportunities` - Internships, freelance work, scholarships
- `events` - Workshops, conferences, networking events
- `jobs` - Full-time, part-time, remote positions
- `resources` - Educational materials and tools
- `saved_items` - User bookmarks
- `likes` - User likes and social engagement
- `user_engagement_history` - Complete user behavior tracking
- `click_throughs` - External link tracking

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting on all endpoints
- CORS protection
- Input validation and sanitization
- Helmet security headers

## 📊 Analytics & Monitoring

- User engagement tracking
- Content performance metrics
- Click-through analytics
- Recommendation effectiveness
- Real-time preference learning

## 🚀 Production Deployment

1. Set `NODE_ENV=production`
2. Update `FRONTEND_URL` to production domain
3. Use a secure `JWT_SECRET`
4. Configure proper rate limiting
5. Set up monitoring and logging

## 🔧 Development

### Project Structure
```
backend/
├── config/
│   └── database.js          # MongoDB connection and indexes
├── middleware/
│   └── auth.js              # Authentication middleware
├── models/
│   └── User.js              # User model and methods
├── routes/
│   ├── auth.js              # Authentication routes
│   ├── content.js           # Content management routes
│   ├── engagement.js        # User engagement routes
│   └── recommendations.js   # Recommendation engine routes
├── services/
│   └── recommendationEngine.js # Hybrid recommendation algorithm
├── server.js                # Main server file
├── package.json
└── README.md
```

### Adding New Features
1. Create route handlers in appropriate route files
2. Add database operations in models
3. Update API client in frontend
4. Test with Postman or frontend integration

## 🐛 Troubleshooting

### Common Issues
1. **MongoDB Connection**: Check connection string and network access
2. **JWT Errors**: Verify JWT_SECRET is set correctly
3. **CORS Issues**: Update FRONTEND_URL in environment
4. **Rate Limiting**: Adjust limits in server.js if needed

### Logs
Check console output for detailed error messages and debugging information.

