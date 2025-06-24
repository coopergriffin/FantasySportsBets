# 🏗️ FantasyBets System Architecture

**Complete technical overview of how features flow through the codebase**

---

## 📋 **Table of Contents**

1. [Data Flow Overview](#data-flow-overview)
2. [Authentication Flow](#authentication-flow)
3. [Sports Betting Flow](#sports-betting-flow)
4. [Advertisement System Flow](#advertisement-system-flow)
5. [Timezone Management Flow](#timezone-management-flow)
6. [File Structure & Responsibilities](#file-structure--responsibilities)
7. [API Architecture](#api-architecture)
8. [Database Schema](#database-schema)
9. [Configuration System](#configuration-system)
10. [Production Deployment](#production-deployment)

---

## 🔄 **Data Flow Overview**

### **High-Level Architecture**
```
[User Browser] ↔ [React Frontend] ↔ [Express Backend] ↔ [SQLite Database]
                                           ↕
                                   [The Odds API]
                                           ↕
                                   [Ad Platform APIs]
```

### **Request Lifecycle**
```
1. User Action (click bet button)
2. React Component (BettingPanel.jsx)
3. API Call (api.js)
4. Express Route (server.js)
5. Database Query (SQLite)
6. Response Processing
7. State Update (React)
8. UI Re-render
```

---

## 🔐 **Authentication Flow**

### **Registration Process**
```
Login.jsx → onShowRegister() → Register.jsx → handleSubmit() →
POST /register → server.js → bcrypt.hash() → SQLite users table →
JWT token generation → Response to frontend → localStorage storage
```

**File Journey**:
1. **`client/src/components/Login.jsx`** - Login form UI
2. **`client/src/components/Register.jsx`** - Registration form UI
3. **`client/src/api.js`** - API communication functions
4. **`server.js`** - Registration endpoint (`POST /register`)
5. **`utils/auth.js`** - JWT token generation
6. **SQLite Database** - User storage

### **Login Process**
```
Login.jsx → handleLogin() → POST /login → server.js →
bcrypt.compare() → JWT generation → localStorage → App.jsx state update
```

### **Authentication Verification**
```
Every API call → authenticateToken middleware → JWT verification →
req.user populated → Route handler execution
```

**Security Features**:
- Password hashing with bcrypt (salt rounds: 10)
- JWT tokens with expiration
- Rate limiting on auth endpoints
- Input validation with express-validator

---

## 🎯 **Sports Betting Flow**

### **Odds Data Lifecycle**
```
[The Odds API] → fetchOddsForSport() → sports-config.js normalization →
SQLite odds_cache → GET /api/odds → React components → User display
```

**Detailed Process**:

#### **1. Data Fetching** (`server.js`)
```javascript
// 4-key rotation system
for (apiKey of apiKeys) {
    try {
        response = await fetch(oddsApiUrl + apiKey)
        if (response.ok) break // Success, use this key
    } catch (error) {
        // Try next key
    }
}
```

#### **2. Data Normalization** (`sports-config.js`)
```javascript
// Centralized sport configuration
const SPORTS_CONFIG = {
    NFL: {
        maxGamesPerFetch: 5,
        cacheMinutes: 60,
        minBetCutoff: 15
    }
}
```

#### **3. Caching Strategy** (`server.js`)
```javascript
// Smart cache logic
if (cacheAge > CACHE_DURATION || forceRefresh) {
    await fetchOddsForSport() // Refresh cache
} else {
    // Use cached data
}
```

#### **4. Frontend Display** (`App.jsx`)
```javascript
// Game rendering with real-time timezone conversion
odds.map(game => (
    <GameCard 
        game={game}
        onBet={handlePlaceBet}
        timezone={user.timezone}
    />
))
```

### **Bet Placement Flow**
```
User clicks team → BettingPanel.jsx → handlePlaceBet() →
POST /api/bet → server.js → verifyOddsForBetting() →
SQLite bets table → User balance update → Frontend refresh
```

**File Journey**:
1. **`App.jsx`** - Game display and bet button
2. **`client/src/api.js`** - `placeBet()` function
3. **`server.js`** - `POST /api/bet` endpoint
4. **`server.js`** - `verifyOddsForBetting()` - Ensure odds are still valid
5. **SQLite Database** - Insert bet record, update user balance
6. **`BettingPanel.jsx`** - Display updated betting history

### **Cash-Out System Flow**
```
User clicks "Sell Bet" → getSellQuote() → fetchFreshOddsForGame() →
Calculate fair value → SellBetModal → User confirms →
POST /sell-bet → Update bet status → Balance adjustment
```

**Fair Value Calculation**:
```javascript
// No house edge - purely mathematical
const currentWinProbability = oddsToPercent(currentOdds)
const potentialPayout = originalBet * (originalOdds / 100)
const fairCashOut = potentialPayout * currentWinProbability
```

---

## 📱 **Advertisement System Flow**

### **Configuration to Display Pipeline**
```
config.js → server.js (/api/ads/config) → AdComponent.jsx →
MainLayout.jsx → User sees ads
```

**Detailed Process**:

#### **1. Configuration** (`config.js`)
```javascript
const ADS_CONFIG = {
    enabled: true,              // Global toggle
    developmentMode: true,      // Fake vs real ads
    placements: {
        header: { enabled: true, size: '728x90' },
        sidebar: { enabled: true, size: '300x250' }
    },
    fakeAds: {
        sportsbook: [...],      // Demo ad content
        banner: [...]
    }
}
```

#### **2. API Endpoint** (`server.js`)
```javascript
app.get('/api/ads/config', (req, res) => {
    res.json({
        enabled: config.ads.enabled,
        placements: config.ads.placements,
        fakeAds: config.ads.developmentMode ? config.ads.fakeAds : null
    })
})
```

#### **3. Component Rendering** (`AdComponent.jsx`)
```javascript
useEffect(() => {
    fetchAdConfig() → selectRandomAd() → setCurrentAd()
}, [placement])

// Different layouts per placement
if (placement === 'header') return <BannerAd />
if (placement === 'sidebar') return <RectangleAd />
```

#### **4. Layout Integration** (`MainLayout.jsx`)
```javascript
<div className="layout-container">
    <main className="content-area">{children}</main>
    <aside className="sidebar">
        <AdComponent placement="sidebar" />
    </aside>
</div>
```

### **Production Ad Integration**
**When ready for real ads**:
1. Set `developmentMode: false` in config.js
2. Enable Google AdSense in platforms config
3. Add real ad unit IDs
4. Deploy with real ad network integration

### **Easy Control**:
```javascript
// In config.js - toggle all ads instantly
const ADS_CONFIG = {
    enabled: false,  // Hide all ads for demos
    developmentMode: true,  // Show fake ads vs real
}
```

---

## 🌍 **Timezone Management Flow**

### **Complete Timezone Lifecycle**
```
User selects timezone → Header.jsx → handleTimezoneChange() →
PUT /user/timezone → Server validation → Database update →
Client state update → All times re-render → Betting history refresh
```

**No API Waste Design**:
```javascript
// Game times: Pure client-side conversion (no API calls)
const formattedTime = formatTimeForDisplay(utcTimestamp, userTimezone)

// Betting history: Single refresh call to get server-formatted times
setBetsRefreshTrigger(prev => prev + 1)
```

**File Journey**:
1. **`Header.jsx`** - Timezone dropdown
2. **`timeUtils.js`** - `formatTimeForDisplay()` utility
3. **`server.js`** - `PUT /user/timezone` endpoint
4. **`App.jsx`** - `handleTimezoneChange()` handler
5. **`BettingPanel.jsx`** - Automatic refresh trigger
6. **All time displays** - Instant visual updates

---

## 📁 **File Structure & Responsibilities**

### **Frontend Structure** (`/client/src/`)
```
components/
├── AdComponent.jsx         # Advertisement display logic
├── AdComponent.css         # Ad styling (responsive, all placements)
├── BettingHistory.jsx      # Past bets display (read-only)
├── BettingHistory.css      # Betting history styles
├── BettingPanel.jsx        # Active bets + history (combined view)
├── BettingPanel.css        # Combined betting interface styles
├── Header.jsx              # Logo, nav, timezone selector
├── Header.css              # Header responsive design
├── Leaderboard.jsx         # Global user rankings
├── Leaderboard.css         # Leaderboard table styles
├── Login.jsx               # User authentication form
├── Login.css               # Auth form styles
├── MainLayout.jsx          # Page layout with sidebar
├── MainLayout.css          # Grid layout + responsive design
├── Notification.jsx        # Toast notifications
├── Notification.css        # Notification animations
├── Register.jsx            # User registration form
├── Register.css            # Registration form styles
├── SellBetModal.jsx        # Cash-out confirmation modal
└── SellBetModal.css        # Modal styles

utils/
├── api.js                  # All API communication functions
└── timeUtils.js            # Timezone conversion utilities

App.jsx                     # Main router + global state
App.css                     # Global styles + responsive design
main.jsx                    # React entry point
```

### **Backend Structure** (`/`)
```
server.js                   # Main Express server (1989 lines)
├── Database setup          # SQLite schema creation
├── Authentication routes   # /register, /login, /user
├── Sports betting routes   # /api/odds, /api/bet, /sell-bet
├── Timezone routes         # /user/timezone
├── Advertisement routes    # /api/ads/config
├── Utility functions       # Odds fetching, caching, validation
└── Error handling          # Comprehensive error management

config.js                   # Central configuration
├── Server settings         # Port, JWT secret, API keys
├── Odds API configuration  # URLs, regions, markets
└── Advertisement config    # Placement settings, fake ads

sports-config.js            # Sports data management
├── Sport definitions       # NFL, NBA, MLB, NHL settings
├── API provider mappings   # Sport key translations
├── Betting rules           # Cutoff times, cache duration
└── Utility functions       # Sport validation, normalization

utils/
├── auth.js                 # JWT token management
└── validation.js           # Input validation rules

tests/
├── auth.test.js            # Authentication testing
└── setup.js                # Test configuration
```

---

## 🔌 **API Architecture**

### **RESTful Endpoint Design**

#### **Authentication Endpoints**
```
POST /register              # Create new user account
POST /login                 # Authenticate user
GET  /user                  # Get current user info
PUT  /user/timezone         # Update user timezone
```

#### **Sports Betting Endpoints**
```
GET  /api/odds              # Get games for sport (paginated)
POST /api/bet               # Place new bet
GET  /bets/:userId          # Get user's betting history
POST /sell-bet/:betId       # Cash out existing bet
GET  /sell-quote/:betId     # Get cash-out quote
POST /api/resolve-completed-games  # Auto-resolve finished games
```

#### **System Endpoints**
```
GET  /api/ads/config        # Get advertisement configuration
```

### **API Response Patterns**

#### **Success Response**
```javascript
{
    success: true,
    data: { ... },
    pagination: { page, totalPages, hasMore },
    timestamp: "2024-12-XX"
}
```

#### **Error Response**
```javascript
{
    success: false,
    error: "Human readable error message",
    code: "ERROR_CODE",
    details: { ... }
}
```

### **Authentication Middleware**
```javascript
const authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403)
        req.user = user
        next()
    })
}
```

---

## 🗄️ **Database Schema**

### **SQLite Schema Design**

#### **Users Table**
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,              -- Bcrypt hashed
    email TEXT,
    balance REAL DEFAULT 1000.00,
    timezone TEXT DEFAULT 'America/Toronto',
    created_at DATETIME DEFAULT (datetime('now', 'utc'))
);
```

#### **Bets Table**
```sql
CREATE TABLE bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    game TEXT NOT NULL,                  -- "Team A vs Team B"
    team TEXT NOT NULL,                  -- Specific team bet on
    amount REAL NOT NULL,
    odds INTEGER NOT NULL,               -- American odds format
    sport TEXT NOT NULL,                 -- NFL, NBA, MLB, NHL
    status TEXT DEFAULT 'pending',       -- pending, won, lost, sold
    game_date TEXT,                      -- UTC ISO timestamp
    created_at DATETIME DEFAULT (datetime('now', 'utc')),
    status_changed_at DATETIME,          -- When resolved/sold
    final_amount REAL,                   -- Final payout amount
    profit_loss REAL,                    -- Net profit/loss
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### **Odds Cache Table**
```sql
CREATE TABLE odds_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sport TEXT NOT NULL,                 -- NFL, NBA, MLB, NHL
    game TEXT NOT NULL,                  -- "Team A vs Team B"
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    commence_time TEXT NOT NULL,         -- UTC ISO timestamp
    odds TEXT NOT NULL,                  -- JSON array of odds
    created_at DATETIME DEFAULT (datetime('now', 'utc')),
    UNIQUE(sport, home_team, away_team, commence_time)
);
```

### **Data Relationships**
```
users (1) ←→ (many) bets
odds_cache (independent) - Used for game data caching
```

### **Indexing Strategy** (Production)
```sql
-- Performance indexes for production
CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_status ON bets(status);
CREATE INDEX idx_odds_cache_sport ON odds_cache(sport);
CREATE INDEX idx_odds_cache_commence_time ON odds_cache(commence_time);
```

---

## ⚙️ **Configuration System**

### **Environment Variables** (`.env`)
```env
# Server Configuration
PORT=5000
NODE_ENV=production

# Security
JWT_SECRET=your-super-secret-key-256-bits-minimum

# The Odds API (4-key rotation for reliability)
ODDS_API_KEY_1=your-primary-api-key
ODDS_API_KEY_2=your-backup-api-key-1
ODDS_API_KEY_3=your-backup-api-key-2
ODDS_API_KEY_4=your-backup-api-key-3

# Database (Production)
DATABASE_URL=postgresql://user:password@host:port/database
```

### **Configuration Hierarchy**
```
1. Environment Variables (.env) - Secrets, API keys
2. config.js - Application settings, ad configuration
3. sports-config.js - Sports-specific settings
4. Component props - Runtime configuration
```

### **Feature Toggles** (`config.js`)
```javascript
// Easy feature control without code changes
const FEATURES = {
    advertisements: {
        enabled: true,              // Global ad toggle
        developmentMode: false,     // Real vs fake ads
        placements: {
            header: true,
            sidebar: true,
            betweenGames: false
        }
    },
    betting: {
        enabled: true,
        maxBetAmount: 1000,
        minBetAmount: 1,
        sellBetsEnabled: true
    },
    sports: {
        NFL: true,
        NBA: true,
        MLB: true,
        NHL: true
    }
}
```

---

## 🚀 **Production Deployment**

### **Recommended Stack**
```
Frontend: Vercel/Netlify (auto-deploy)
Backend: Railway/Render (PostgreSQL upgrade)
Database: PostgreSQL (production-grade)
CDN: CloudFlare (global performance)
Monitoring: Sentry (error tracking)
```

### **Migration Path**: SQLite → PostgreSQL for production scale

### **Production Checklist**

#### **Security**
- [ ] HTTPS/SSL certificates configured
- [ ] Environment variables secured (not in code)
- [ ] Rate limiting properly configured
- [ ] Input validation comprehensive
- [ ] Error messages don't leak sensitive info

#### **Performance**
- [ ] Database indexes created
- [ ] React components memoized where appropriate
- [ ] Bundle size optimized (< 1MB)
- [ ] CDN configured for static assets
- [ ] Caching headers set correctly

#### **Monitoring**
- [ ] Error tracking (Sentry) implemented
- [ ] Performance monitoring (New Relic/DataDog)
- [ ] Uptime monitoring (Pingdom/UptimeRobot)
- [ ] Log aggregation (LogRocket/Papertrail)

#### **Revenue**
- [ ] Google AdSense account approved
- [ ] Real ad units integrated and tested
- [ ] Analytics tracking implemented
- [ ] Revenue reporting dashboard

---

## 🔮 **Future Architecture Considerations**

### **Microservices Migration Path**
```
Current: Monolithic Express server
Phase 1: Extract auth service
Phase 2: Extract betting service  
Phase 3: Extract odds service
Phase 4: Extract ad service
```

### **Database Scaling Strategy**
```
Current: SQLite (perfect for MVP)
Phase 1: PostgreSQL (production scale)
Phase 2: Read replicas (global users)
Phase 3: Sharding by region (massive scale)
```

### **API Evolution**
```
Current: REST API
Phase 1: GraphQL for flexible queries
Phase 2: Real-time subscriptions (WebSockets)
Phase 3: gRPC for internal services
```

### **Frontend Scaling**
```
Current: Vite SPA
Phase 1: Code splitting + lazy loading
Phase 2: Server-side rendering (Next.js)
Phase 3: Micro-frontends (multiple teams)
```

---

**Last Updated**: December 2024  
**Architecture Version**: 1.0.0  
**Next Review**: Q1 2025 