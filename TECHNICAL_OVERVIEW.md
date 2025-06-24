# FantasyBets - Technical Overview

## 📋 Project Overview

FantasyBets is a responsible sports betting platform designed to protect users from predatory gambling practices while providing an engaging, fair betting experience. Built with modern web technologies, it emphasizes transparency, education, and user protection.

## 🏗️ Architecture

### Frontend (React + Vite)
- **Framework**: React 18 with functional components and hooks
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: CSS modules and custom CSS
- **State Management**: React useState and useEffect hooks
- **Authentication**: JWT token-based authentication stored in localStorage

### Backend (Node.js + Express)
- **Runtime**: Node.js with Express.js framework
- **Database**: SQLite3 for local development and data persistence
- **Authentication**: JWT (JSON Web Tokens) for secure user sessions
- **API Integration**: External sports odds API for real-time betting data
- **Security**: Helmet.js for production security headers

### Database Schema
- **Users**: User accounts, authentication credentials, and balance tracking
- **Bets**: Betting history with game details, amounts, and outcomes
- **Odds Cache**: Cached sports odds data with expiration handling

## 📁 Project Structure

```
FantasySportsBets/
├── client/                     # Frontend React application
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── api.js             # API communication layer
│   │   ├── App.jsx            # Main application component
│   │   └── main.jsx           # React entry point
│   ├── public/                # Static assets
│   └── package.json           # Frontend dependencies
├── server.js                  # Main backend server
├── config.js                  # Configuration management
├── db.js                      # Database initialization
├── utils/                     # Utility functions
│   ├── auth.js               # Authentication helpers
│   └── validation.js         # Input validation
├── tests/                     # Test suites
└── package.json              # Backend dependencies
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14.18.0 or higher)
- npm or yarn package manager
- Git for version control

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd FantasySportsBets
   ```

2. **Install backend dependencies**
   ```bash
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Environment Configuration**
   - Copy `.env.example` to `.env` (if available)
   - Configure your sports odds API key
   - Set JWT secret and other environment variables

5. **Database Setup**
   - SQLite database will be created automatically on first run
   - Database file: `bets.db`

### Running the Application

#### Development Mode
```bash
# Start both backend and frontend with hot reload
npm run dev
```

#### Production Mode
```bash
# Start backend only
npm start

# Build and serve frontend
cd client
npm run build
npm run preview
```

### Default Access
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **Test Credentials**: 
  - Username: `testuser`
  - Password: `test123`

## 🔧 Key Features

### User Management
- **Registration**: New user account creation with validation
- **Authentication**: Secure login/logout with JWT tokens
- **Balance Tracking**: Virtual currency for betting activities

### Betting System
- **Real-time Odds**: Live sports odds from external API
- **Multi-Sport Support**: NFL, NBA, MLB, NHL
- **Flexible Betting**: Preset amounts or custom bet values
- **Team Selection**: Choose winning team for each game

### Data Management
- **Betting History**: Complete record of user bets
- **Leaderboard**: Global user rankings
- **Caching System**: Optimized API calls with intelligent caching
- **Pagination**: Efficient data loading for large datasets

## 🛠️ Development Guidelines

### Code Organization
- **Components**: Single responsibility, reusable React components
- **API Layer**: Centralized API communication with error handling
- **State Management**: Local component state with prop drilling for shared data
- **Styling**: Component-specific CSS files with BEM-like naming

### Best Practices
- **Error Handling**: Try-catch blocks with user-friendly error messages
- **Input Validation**: Both client-side and server-side validation
- **Security**: JWT tokens, input sanitization, CORS configuration
- **Performance**: Lazy loading, pagination, and caching strategies

### Testing
- **Unit Tests**: Jest for backend utility functions
- **Integration Tests**: API endpoint testing
- **Frontend Testing**: Component testing with React Testing Library (recommended)

## 🔐 Security Considerations

### Authentication & Authorization
- JWT tokens with expiration
- Secure password hashing (bcrypt)
- Token validation middleware
- Protected routes and API endpoints

### Data Protection
- Input sanitization and validation
- SQL injection prevention
- XSS protection with Content Security Policy
- CORS configuration for API access

### Production Security
- Helmet.js security headers
- Environment variable management
- API rate limiting (recommended for production)
- HTTPS enforcement (recommended for production)

## 📊 API Documentation

### Authentication Endpoints
- `POST /register` - User registration
- `POST /login` - User authentication
- `GET /user` - Get user profile (authenticated)

### Betting Endpoints
- `GET /api/odds` - Fetch sports odds (authenticated)
- `POST /api/bets` - Place a new bet (authenticated)
- `GET /api/bets` - Get user betting history (authenticated)
- `DELETE /api/bets/:id` - Cancel a bet (authenticated)

### Utility Endpoints
- `GET /api/leaderboard` - Global user leaderboard

## 🧪 Testing Strategy

### Backend Testing
```bash
npm test
```

### Frontend Testing
```bash
cd client
npm run test
```

### Manual Testing
- User registration and login flows
- Betting functionality across different sports
- Responsive design on various screen sizes
- Error handling for network failures

## 🚀 Deployment

### Production Checklist
- [ ] Set NODE_ENV=production
- [ ] Configure production database
- [ ] Set up environment variables
- [ ] Build frontend for production
- [ ] Configure reverse proxy (nginx recommended)
- [ ] Set up SSL certificates
- [ ] Configure monitoring and logging

### Deployment Options
- **Traditional**: VPS with Node.js and nginx
- **Container**: Docker containerization
- **Platform**: Heroku, Vercel, or similar platforms
- **Cloud**: AWS, GCP, or Azure deployment

## 🔄 Maintenance

### Regular Tasks
- Monitor API usage and rate limits
- Update sports odds cache as needed
- Review and rotate JWT secrets
- Update dependencies for security patches
- Monitor database size and performance

### Monitoring
- Application logs for error tracking
- API response times and success rates
- User activity and betting patterns
- Database query performance

## 📈 Future Enhancements

### Planned Features
- Real-time notifications for game updates
- Advanced betting options (parlays, over/under)
- Social features (friend challenges)
- Mobile app development
- Integration with more sports leagues

### Technical Improvements
- Database migration to PostgreSQL for production
- Redis caching for improved performance
- WebSocket implementation for real-time updates
- Comprehensive test coverage
- CI/CD pipeline implementation

## 🤝 Contributing

### Development Workflow
1. Create feature branch from main
2. Implement changes with proper testing
3. Update documentation as needed
4. Submit pull request with clear description
5. Code review and approval process

### Code Standards
- ESLint configuration for code quality
- Prettier for consistent formatting
- Meaningful commit messages
- Comprehensive documentation for new features

## 📞 Support

For technical issues or questions:
1. Check this documentation first
2. Review the codebase comments and structure
3. Create detailed issue reports with reproduction steps
4. Include relevant logs and error messages

---

**Last Updated**: December 2024
**Version**: 1.0.0
**Maintainers**: Development Team 