# Fantasy Sports Betting - Backend Documentation

## 🚀 Backend Overview

This is the Node.js/Express backend API for the Fantasy Sports Betting platform. It provides authentication, sports odds data, betting functionality, and user management with a SQLite database.

## 🏗️ Technology Stack

- **Node.js**: JavaScript runtime environment
- **Express.js**: Web application framework
- **SQLite3**: Local database for development
- **JWT**: JSON Web Tokens for authentication
- **bcrypt**: Password hashing for security
- **Helmet**: Security middleware for production
- **CORS**: Cross-origin resource sharing configuration

## 📁 Project Structure

```
FantasySportsBets/
├── server.js                 # Main server file and API routes
├── config.js                 # Configuration management
├── db.js                     # Database initialization and setup
├── types.js                  # Type definitions and constants
├── utils/                    # Utility functions
│   ├── auth.js              # Authentication helpers
│   └── validation.js        # Input validation functions
├── tests/                    # Test suites
│   ├── auth.test.js         # Authentication tests
│   └── setup.js             # Test configuration
├── package.json             # Dependencies and scripts
├── jest.config.js           # Jest testing configuration
└── bets.db                  # SQLite database file (auto-generated)
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14.18.0 or higher)
- npm package manager
- Sports odds API key (optional for development)

### Installation
```bash
# Install dependencies
npm install

# Start development server
npm start

# Run with development mode
npm run dev
```

### Environment Configuration
Create a `.env` file in the root directory:
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Authentication
JWT_SECRET=your-super-secret-jwt-key-here

# Sports Odds API
ODDS_API_KEY=your-odds-api-key-here

# Database
DB_PATH=./bets.db
```

### Available Scripts
```bash
npm start           # Start production server
npm run dev         # Start with frontend concurrently
npm test            # Run test suite
npm run test:watch  # Run tests in watch mode
```

## 🗄️ Database Schema

### Users Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    balance REAL DEFAULT 1000.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Bets Table
```sql
CREATE TABLE bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    game TEXT NOT NULL,
    amount REAL NOT NULL,
    odds REAL NOT NULL,
    sport TEXT NOT NULL,
    game_date DATETIME NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
```

### Odds Cache Table
```sql
CREATE TABLE odds_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sport TEXT NOT NULL,
    game_data TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    commence_time DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_fetched INTEGER NOT NULL
);
```

## 🔌 API Endpoints

### Authentication Endpoints

#### POST /register
Register a new user account.

**Request Body:**
```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "username": "newuser",
    "email": "user@example.com",
    "balance": 1000.0
  }
}
```

#### POST /login
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "username": "testuser",
  "password": "test123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "balance": 1000.0
  }
}
```

#### GET /user
Get current user profile (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "id": 1,
  "username": "testuser",
  "email": "test@example.com",
  "balance": 975.0
}
```

### Betting Endpoints

#### GET /api/odds
Fetch sports odds with pagination and filtering.

**Query Parameters:**
- `sport` (optional): Filter by sport (NFL, NBA, MLB, NHL, or 'all')
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "games": [
    {
      "id": "unique-game-id",
      "homeTeam": "Team A",
      "awayTeam": "Team B", 
      "sport": "NFL",
      "commenceTime": "2024-12-20T20:00:00Z",
      "odds": [
        {"price": -110, "team": "Team A"},
        {"price": +105, "team": "Team B"}
      ]
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "hasMore": true,
    "total": 50
  }
}
```

#### POST /api/bets
Place a new bet on a game.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "game": "Team A vs Team B",
  "amount": 25.0,
  "odds": -110,
  "sport": "NFL",
  "game_date": "2024-12-20T20:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bet placed successfully",
  "bet": {
    "id": 123,
    "game": "Team A vs Team B",
    "amount": 25.0,
    "odds": -110,
    "status": "pending"
  },
  "newBalance": 975.0
}
```

#### GET /api/bets
Get user's betting history.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "bets": [
    {
      "id": 123,
      "game": "Team A vs Team B",
      "amount": 25.0,
      "odds": -110,
      "sport": "NFL",
      "status": "pending",
      "created_at": "2024-12-20T15:30:00Z"
    }
  ]
}
```

#### DELETE /api/bets/:id
Cancel a pending bet.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Bet cancelled successfully",
  "refundAmount": 25.0,
  "newBalance": 1000.0
}
```

### Utility Endpoints

#### GET /api/leaderboard
Get global user leaderboard.

**Response:**
```json
{
  "leaderboard": [
    {
      "username": "topuser",
      "balance": 1500.0,
      "rank": 1
    },
    {
      "username": "player2", 
      "balance": 1200.0,
      "rank": 2
    }
  ]
}
```

## 🔐 Authentication & Security

### JWT Implementation
- **Token Generation**: User login generates JWT with user ID and expiration
- **Token Validation**: Middleware validates tokens on protected routes
- **Token Storage**: Frontend stores tokens in localStorage
- **Token Expiration**: Configurable expiration time (default: 24 hours)

### Password Security
- **Hashing**: bcrypt with salt rounds for secure password storage
- **Validation**: Minimum password requirements enforced
- **No Plain Text**: Passwords never stored in plain text

### API Security
- **CORS Configuration**: Controlled cross-origin access
- **Helmet Security**: Production security headers
- **Input Validation**: All inputs validated and sanitized
- **Rate Limiting**: (Recommended for production)

### Middleware Stack
```javascript
// Security middleware (production only)
app.use(helmet())

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}))

// Request parsing
app.use(express.json())

// Authentication middleware
const authenticateToken = (req, res, next) => {
  // JWT validation logic
}
```

## 📊 Data Management

### Caching Strategy
- **Odds Caching**: Sports odds cached for 2 hours to reduce API calls
- **Cache Validation**: Automatic cache invalidation and refresh
- **Database Caching**: SQLite for efficient local data storage
- **API Rate Limiting**: Intelligent API usage to stay within limits

### Database Operations
- **Connection Management**: Single SQLite connection with proper error handling
- **Query Optimization**: Indexed queries for performance
- **Transaction Support**: Atomic operations for betting and balance updates
- **Backup Strategy**: Regular database backups (recommended for production)

### External API Integration
```javascript
// Sports odds API configuration
const config = {
  server: {
    odds: {
      baseUrl: 'https://api.the-odds-api.com/v4',
      apiKeys: [process.env.ODDS_API_KEY],
      region: 'us',
      markets: 'h2h',
      oddsFormat: 'american'
    }
  }
}
```

## 🧪 Testing

### Test Structure
```
tests/
├── auth.test.js           # Authentication endpoint tests
├── setup.js               # Test configuration and helpers
└── (additional test files)
```

### Running Tests
```bash
npm test                   # Run all tests
npm run test:watch         # Watch mode for development
npm run test:coverage      # Generate coverage report
```

### Test Coverage Areas
- **Authentication**: Registration, login, token validation
- **Betting Logic**: Bet placement, validation, cancellation
- **Database Operations**: CRUD operations and data integrity
- **API Endpoints**: Request/response validation
- **Security**: Input validation and authorization

### Example Test
```javascript
describe('Authentication', () => {
  test('should register new user successfully', async () => {
    const userData = {
      username: 'testuser',
      email: 'test@example.com', 
      password: 'testpass123'
    }
    
    const response = await request(app)
      .post('/register')
      .send(userData)
      .expect(201)
      
    expect(response.body.success).toBe(true)
    expect(response.body.user.username).toBe('testuser')
  })
})
```

## ⚡ Performance Optimization

### Current Optimizations
- **Database Indexing**: Optimized queries with proper indexes
- **Connection Pooling**: Efficient database connection management
- **Caching Layer**: Intelligent caching of external API data
- **Async Operations**: Non-blocking I/O for better performance

### Monitoring Points
- **API Response Times**: Track endpoint performance
- **Database Query Times**: Monitor slow queries
- **External API Usage**: Track rate limit usage
- **Memory Usage**: Monitor Node.js memory consumption

### Recommended Improvements
- **Redis Caching**: Implement Redis for production caching
- **Database Migration**: Move to PostgreSQL for production
- **Load Balancing**: Multiple server instances for scaling
- **CDN Integration**: Static asset delivery optimization

## 🔧 Configuration Management

### config.js Structure
```javascript
module.exports = {
  server: {
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    auth: {
      jwtSecret: process.env.JWT_SECRET || 'default-secret',
      tokenExpiration: '24h'
    },
    odds: {
      baseUrl: 'https://api.the-odds-api.com/v4',
      apiKeys: [process.env.ODDS_API_KEY],
      region: 'us',
      markets: 'h2h',
      oddsFormat: 'american'
    },
    database: {
      path: process.env.DB_PATH || './bets.db'
    }
  }
}
```

### Environment Variables
- **PORT**: Server port (default: 5000)
- **NODE_ENV**: Environment (development/production)
- **JWT_SECRET**: Secret key for JWT signing
- **ODDS_API_KEY**: External sports odds API key
- **DB_PATH**: SQLite database file path

## 🚀 Deployment

### Production Checklist
- [ ] Set NODE_ENV=production
- [ ] Configure production database (PostgreSQL recommended)
- [ ] Set secure JWT_SECRET
- [ ] Configure sports odds API keys
- [ ] Set up process management (PM2)
- [ ] Configure reverse proxy (nginx)
- [ ] Set up SSL certificates
- [ ] Configure monitoring and logging

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### Process Management
```bash
# Using PM2 for production
npm install -g pm2
pm2 start server.js --name "fantasy-betting-api"
pm2 startup
pm2 save
```

## 📊 Monitoring & Logging

### Logging Strategy
```javascript
// Basic logging implementation
const log = {
  info: (message, data) => console.log(`[INFO] ${message}`, data),
  error: (message, error) => console.error(`[ERROR] ${message}`, error),
  warn: (message, data) => console.warn(`[WARN] ${message}`, data)
}
```

### Monitoring Points
- **API Endpoint Usage**: Track most used endpoints
- **Error Rates**: Monitor 4xx and 5xx responses
- **Database Performance**: Query execution times
- **External API Usage**: Track sports odds API calls
- **User Activity**: Registration, login, betting patterns

### Recommended Tools
- **Logging**: Winston or Bunyan for structured logging
- **Monitoring**: New Relic, DataDog, or custom solutions
- **Error Tracking**: Sentry for error reporting
- **Metrics**: Prometheus with Grafana dashboards

## 🔄 Maintenance & Operations

### Regular Tasks
- **Database Cleanup**: Remove old odds cache data
- **Log Rotation**: Manage log file sizes
- **Security Updates**: Keep dependencies updated
- **API Key Rotation**: Rotate sports odds API keys
- **Backup Management**: Regular database backups

### Health Checks
```javascript
// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version
  })
})
```

## 📈 Future Enhancements

### Planned Features
- **Real-time Updates**: WebSocket integration for live odds
- **Advanced Betting**: Parlays, over/under, prop bets
- **User Notifications**: Email/SMS notifications for bet results
- **Social Features**: Friend challenges and group betting
- **Payment Integration**: Real money transactions (with proper licensing)

### Technical Improvements
- **Database Migration**: PostgreSQL with connection pooling
- **Caching Layer**: Redis for session and data caching
- **Microservices**: Split into smaller, focused services
- **API Documentation**: OpenAPI/Swagger documentation
- **CI/CD Pipeline**: Automated testing and deployment

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create feature branch
3. Install dependencies: `npm install`
4. Make changes with proper testing
5. Run test suite: `npm test`
6. Submit pull request with clear description

### Code Standards
- **ESLint**: Follow configured linting rules
- **Comments**: Document complex logic and API endpoints
- **Error Handling**: Comprehensive error handling for all endpoints
- **Security**: Follow security best practices for all changes

---

**Last Updated**: December 2024  
**Backend Version**: 1.0.0  
**Node.js Version**: 18.x+  
**Express Version**: 4.x 