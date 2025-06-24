# 🚀 FantasyBets Production Deployment Guide

**Complete guide to deploying FantasyBets to production with revenue optimization**

---

## 📋 **Pre-Deployment Checklist**

### **Security Hardening**
- [ ] HTTPS/SSL certificates configured
- [ ] Environment variables secured (not hardcoded)
- [ ] JWT secret strong (256+ bits)
- [ ] API keys stored securely
- [ ] Rate limiting enabled for all endpoints
- [ ] Input validation comprehensive
- [ ] Error messages sanitized (no sensitive data leaks)

### **Performance Optimization**
- [ ] Database indexes created for production queries
- [ ] React components memoized where beneficial
- [ ] Bundle size optimized (< 1MB gzipped)
- [ ] Images optimized and compressed
- [ ] CDN configured for static assets
- [ ] Caching headers properly set

### **Revenue System**
- [ ] Google AdSense account approved
- [ ] Ad units created and tested
- [ ] Advertisement config updated for production
- [ ] Revenue tracking implemented
- [ ] Analytics integration complete

---

## 🏗️ **Recommended Infrastructure**

### **Frontend Deployment - Vercel (Recommended)**
```yaml
Platform: Vercel
Repository: GitHub integration
Build Command: npm run build
Output Directory: dist/
Node Version: 18.x

Environment Variables:
  VITE_API_URL: https://api.fantasybets.com
  VITE_ENVIRONMENT: production
```

**Vercel Configuration** (`vercel.json`):
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

### **Backend Deployment - Railway (Recommended)**
```yaml
Platform: Railway
Repository: GitHub integration
Start Command: npm start
Health Check: GET /health
Port: Environment variable PORT

Environment Variables:
  NODE_ENV: production
  JWT_SECRET: [256-bit secret]
  ODDS_API_KEY_1: [primary key]
  ODDS_API_KEY_2: [backup key 1]
  ODDS_API_KEY_3: [backup key 2]
  ODDS_API_KEY_4: [backup key 3]
  DATABASE_URL: [PostgreSQL connection string]
```

### **Database - PostgreSQL (Production)**
```yaml
Provider: Railway PostgreSQL / Render PostgreSQL
Version: PostgreSQL 15+
Connection: SSL enabled
Backup: Daily automated backups
Monitoring: Connection pool monitoring
```

---

## 🗄️ **Database Migration: SQLite → PostgreSQL**

### **Migration Script** (`migrate-to-postgres.js`)
```javascript
const sqlite3 = require('sqlite3');
const { Pool } = require('pg');

// Migration script to move from SQLite to PostgreSQL
async function migrateDatabase() {
  const sqliteDb = new sqlite3.Database('./bets.db');
  const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Create PostgreSQL tables
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        balance DECIMAL(10,2) DEFAULT 1000.00,
        timezone VARCHAR(100) DEFAULT 'America/Toronto',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS bets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        game VARCHAR(255) NOT NULL,
        team VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        odds INTEGER NOT NULL,
        sport VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        game_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status_changed_at TIMESTAMP,
        final_amount DECIMAL(10,2),
        profit_loss DECIMAL(10,2)
      );
    `);

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS odds_cache (
        id SERIAL PRIMARY KEY,
        sport VARCHAR(50) NOT NULL,
        game VARCHAR(255) NOT NULL,
        home_team VARCHAR(255) NOT NULL,
        away_team VARCHAR(255) NOT NULL,
        commence_time TIMESTAMP NOT NULL,
        odds TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sport, home_team, away_team, commence_time)
      );
    `);

    // Migrate data (implement based on your specific needs)
    console.log('Database migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}
```

### **Production Database Config** (`db-production.js`)
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

module.exports = pool;
```

---

## 💰 **Revenue System Activation**

### **Google AdSense Integration**

#### **1. AdSense Account Setup**
```bash
1. Apply for Google AdSense account
2. Add your domain: fantasybets.com
3. Wait for approval (1-2 weeks)
4. Create ad units for different placements
```

#### **2. Production Ad Configuration** (`config.js`)
```javascript
const ADS_CONFIG = {
  enabled: true,                    // Enable ads in production
  developmentMode: false,           // Use real ads, not fake ones
  platforms: {
    googleAdsense: {
      enabled: true,
      publisherId: 'ca-pub-XXXXXXXXXX',
      adUnits: {
        header: 'XXXXXXXXXX',
        sidebar: 'XXXXXXXXXX',
        mobile: 'XXXXXXXXXX'
      }
    }
  },
  placements: {
    header: { 
      enabled: true, 
      size: '728x90',
      mobileSize: '320x50'
    },
    sidebar: { 
      enabled: true, 
      size: '300x250',
      mobileSize: '300x250'
    }
  }
};
```

#### **3. Real Ad Component** (`AdComponent-production.jsx`)
```javascript
// Production ad component using Google AdSense
import { useEffect } from 'react';

function ProductionAdComponent({ placement, adUnit }) {
  useEffect(() => {
    // Load Google AdSense script
    if (window.adsbygoogle) {
      window.adsbygoogle.push({});
    }
  }, []);

  return (
    <ins 
      className="adsbygoogle"
      style={{ display: 'block' }}
      data-ad-client="ca-pub-XXXXXXXXXX"
      data-ad-slot={adUnit}
      data-ad-format="auto"
      data-full-width-responsive="true"
    ></ins>
  );
}
```

### **Revenue Tracking & Analytics**

#### **Google Analytics 4 Setup**
```javascript
// Add to index.html
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

---

## 🔐 **Security Configuration**

### **Environment Variables** (`.env.production`)
```env
# Server Configuration
NODE_ENV=production
PORT=5000

# Security
JWT_SECRET=your-super-secure-256-bit-secret-key-here
BCRYPT_ROUNDS=12

# Database
DATABASE_URL=postgresql://user:password@host:port/database?ssl=true

# The Odds API (4-key rotation)
ODDS_API_KEY_1=your-primary-odds-api-key
ODDS_API_KEY_2=your-backup-odds-api-key-1
ODDS_API_KEY_3=your-backup-odds-api-key-2
ODDS_API_KEY_4=your-backup-odds-api-key-3

# External Services
GOOGLE_ADSENSE_PUBLISHER_ID=ca-pub-XXXXXXXXXX
GOOGLE_ANALYTICS_ID=GA_MEASUREMENT_ID
SENTRY_DSN=https://your-sentry-dsn
```

### **Production Security Headers** (`server.js`)
```javascript
// Production security configuration
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://www.googletagmanager.com", "https://pagead2.googlesyndication.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.the-odds-api.com"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["https://googleads.g.doubleclick.net"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));
}
```

---

## 📊 **Monitoring & Analytics**

### **Error Tracking - Sentry**
```javascript
// Install: npm install @sentry/node @sentry/tracing

const Sentry = require('@sentry/node');
const Tracing = require('@sentry/tracing');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Tracing.Integrations.Express({ app }),
  ],
  tracesSampleRate: 1.0,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());
// ... your routes ...
app.use(Sentry.Handlers.errorHandler());
```

### **Performance Monitoring**
```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version
  });
});
```

---

## 🚀 **Deployment Process**

### **Automated Deployment** (GitHub Actions)
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd client && npm ci && npm run build
      - uses: vercel/action@v1
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - name: Deploy to Railway
        run: railway deploy
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

### **Manual Deployment Steps**

#### **Frontend (Vercel)**
```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Login to Vercel
vercel login

# 3. Configure project
cd client
vercel

# 4. Deploy
vercel --prod
```

#### **Backend (Railway)**
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login to Railway
railway login

# 3. Create project
railway project:create fantasybets-backend

# 4. Add PostgreSQL
railway service:create --name database --template postgresql

# 5. Deploy
railway deploy
```

---

## 🎯 **Post-Deployment Tasks**

### **1. DNS Configuration**
```
# Add CNAME records:
www.fantasybets.com -> vercel-deployment-url
api.fantasybets.com -> railway-deployment-url

# SSL certificates auto-generated by Vercel/Railway
```

### **2. Monitor Key Metrics**
- [ ] Response times (< 200ms for API calls)
- [ ] Error rates (< 1% error rate)
- [ ] Ad revenue (track daily earnings)
- [ ] User engagement (session duration, retention)
- [ ] API usage (stay within The Odds API limits)

### **3. Set Up Alerts**
- [ ] Error rate spike alerts
- [ ] Database connection issues
- [ ] API rate limit warnings
- [ ] Revenue drop alerts

---

## 💡 **Revenue Optimization Strategies**

### **Ad Placement Optimization**
```javascript
// A/B test different ad configurations
const AD_EXPERIMENTS = {
  control: {
    sidebar: true,
    header: false
  },
  variant_a: {
    sidebar: true,
    header: true
  },
  variant_b: {
    sidebar: false,
    header: true,
    betweenGames: true
  }
};
```

### **User Retention Focus**
- **Educational Content**: Help users understand odds and probability
- **Responsible Gaming**: Build trust through user protection features
- **Fair Payouts**: Transparent cash-out system builds user loyalty
- **Performance**: Fast, reliable platform keeps users engaged

---

## 📈 **Scaling Considerations**

### **Database Scaling**
```sql
-- Production indexes for performance
CREATE INDEX CONCURRENTLY idx_bets_user_id ON bets(user_id);
CREATE INDEX CONCURRENTLY idx_bets_status_created ON bets(status, created_at);
CREATE INDEX CONCURRENTLY idx_odds_cache_sport_time ON odds_cache(sport, commence_time);
CREATE INDEX CONCURRENTLY idx_users_username ON users(username);
```

### **API Scaling**
```javascript
// Connection pooling for high traffic
const pool = new Pool({
  max: 50,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle connections
  connectionTimeoutMillis: 2000
});
```

### **CDN Configuration**
```javascript
// Cache static assets aggressively
app.use(express.static('public', {
  maxAge: '1y',  // Cache for 1 year
  etag: true,
  lastModified: true
}));
```

---

## 🎉 **Launch Checklist**

### **Final Pre-Launch**
- [ ] All environment variables configured
- [ ] Database migrated and indexed
- [ ] SSL certificates active
- [ ] Ad units tested and earning
- [ ] Analytics tracking confirmed
- [ ] Error monitoring active
- [ ] Performance monitoring enabled
- [ ] Backup systems tested

### **Launch Day**
- [ ] Deploy to production
- [ ] Monitor error rates closely
- [ ] Check ad revenue reporting
- [ ] Verify all user flows work
- [ ] Monitor database performance
- [ ] Check API rate usage

### **Post-Launch (Week 1)**
- [ ] Daily revenue reports
- [ ] User feedback collection
- [ ] Performance optimization
- [ ] Bug fixes and improvements
- [ ] Marketing campaign launch

---

**🚀 FantasyBets is ready for production deployment and revenue generation!**

*Deployment Guide Version: 1.0.0 | Last Updated: December 2024* 