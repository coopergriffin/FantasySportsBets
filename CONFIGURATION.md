# 🔧 Fantasy Sports Betting - Configuration Guide

## Game Limits Configuration

The application is designed to be easily configurable for different game limits per sport. This helps manage API usage and performance.

### Current Settings (Conservative)
- **Games per sport**: 5
- **Cache refresh**: Every 60 minutes
- **Date range**: Next 2 weeks of games

### Quick Changes

#### 1. Increase Games for All Sports
In `server.js`, find `SPORT_CONFIG` and change:
```javascript
const SPORT_CONFIG = {
    maxGamesPerSport: 25,  // 🔧 Change this number
    // ...
};
```

#### 2. Individual Sport Limits
```javascript
sports: {
    'NFL': { maxGames: 10 },   // Lower for less frequent games
    'NBA': { maxGames: 30 },   // Higher for frequent games
    'MLB': { maxGames: 25 },   // Medium for daily games
    'NHL': { maxGames: 20 }    // Medium frequency
}
```

#### 3. Cache Refresh Frequency
```javascript
const SPORT_CONFIG = {
    cacheRefreshMinutes: 30,   // More frequent updates
    // OR
    cacheRefreshMinutes: 120,  // Less API usage
    // ...
};
```

### Recommended Settings by Use Case

#### 📱 **Development/Testing**
```javascript
maxGamesPerSport: 10,
cacheRefreshMinutes: 30
```

#### 🚀 **Production (Light Usage)**
```javascript
maxGamesPerSport: 15,
cacheRefreshMinutes: 60
```

#### 💪 **Production (Full Featured)**
```javascript
maxGamesPerSport: 25,
cacheRefreshMinutes: 45
```

### API Impact

| Games per Sport | Total Games | API Calls/Hour* |
|----------------|-------------|-----------------|
| 5              | 20          | ~4              |
| 15             | 60          | ~4              |
| 25             | 100         | ~4              |

*Assuming 4 sports and hourly cache refresh

### Performance Notes

- **More games** = More database storage, slightly slower queries
- **Frequent refresh** = More current data, higher API usage
- **Conservative limits** = Faster app, lower costs

### Making Changes

1. Edit the values in `server.js`
2. Restart the server: `npm start`
3. Changes take effect immediately
4. Monitor console output for API usage

### Troubleshooting

**Too many API calls?**
- Increase `cacheRefreshMinutes`
- Decrease `maxGamesPerSport`

**Not enough games shown?**
- Increase `maxGamesPerSport`
- Check individual sport `maxGames` values

**Data too stale?**
- Decrease `cacheRefreshMinutes`
- Monitor API usage to avoid limits 