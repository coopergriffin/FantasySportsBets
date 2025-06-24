# 🚀 FantasyBets Production Deployment Guide

## 📋 Pre-Deployment Checklist

### Security & Performance
- [ ] HTTPS/SSL certificates configured
- [ ] Environment variables secured
- [ ] Database indexes created for production
- [ ] Bundle size optimized (< 1MB)
- [ ] Error tracking (Sentry) implemented

### Revenue System
- [ ] Google AdSense account approved
- [ ] Ad units created and tested
- [ ] Analytics tracking enabled

## 🏗️ Recommended Infrastructure

### Frontend - Vercel
```
Platform: Vercel
Build: npm run build
Environment: VITE_API_URL=https://api.fantasybets.com
```

### Backend - Railway
```
Platform: Railway
Start: npm start
Database: PostgreSQL (auto-provisioned)
Environment Variables: JWT_SECRET, ODDS_API_KEYs, DATABASE_URL
```

## 🗄️ Database Migration

### SQLite → PostgreSQL
```sql
-- Create production tables
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  balance DECIMAL(10,2) DEFAULT 1000.00,
  timezone VARCHAR(100) DEFAULT 'America/Toronto',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  game VARCHAR(255) NOT NULL,
  team VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  odds INTEGER NOT NULL,
  sport VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  game_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add production indexes
CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_status ON bets(status);
```

## 💰 Revenue Activation

### Enable Real Ads (config.js)
```javascript
const ADS_CONFIG = {
  enabled: true,              // Turn on ads
  developmentMode: false,     // Use real ads
  platforms: {
    googleAdsense: {
      enabled: true,
      publisherId: 'ca-pub-XXXXXXXXXX'
    }
  }
};
```

## 🚀 Deployment Commands

### Frontend
```bash
cd client
npm run build
vercel --prod
```

### Backend
```bash
railway login
railway deploy
```

## 📊 Post-Launch Monitoring

### Key Metrics
- Response times (< 200ms)
- Error rates (< 1%)
- Ad revenue (daily tracking)
- User engagement

### Revenue Optimization
- A/B test ad placements
- Monitor user retention
- Focus on fair, transparent experience

---

**Ready for production deployment and revenue generation!** 