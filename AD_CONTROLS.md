# Advertisement Control System

This document explains how to control the advertisement display in the Fantasy Sports Betting application.

## Quick Toggle - Hide All Ads

To **completely disable all ads** (for demos to certain audiences):

1. Open `config.js`
2. Find the `ADS_CONFIG` section
3. Change `enabled: true` to `enabled: false`
4. Restart the server

```javascript
const ADS_CONFIG = {
    enabled: false,  // ← Change this to hide all ads
    // ... rest of config
};
```

## Development vs Production Mode

### Development Mode (Fake Ads)
- Shows placeholder ads with demo content
- Clicking ads shows alert instead of redirecting
- Has "Demo Ad" label in corner

```javascript
developmentMode: true,  // Shows fake ads
```

### Production Mode (Real Ads)
- Integrates with real ad platforms (Google AdSense, Facebook, etc.)
- Actual revenue generation
- Remove demo labels

```javascript
developmentMode: false, // Shows real ads when configured
```

## Individual Ad Placement Controls

You can control specific ad locations:

```javascript
placements: {
    header: {
        enabled: true,     // Header banner ad
        type: 'banner',
        size: '728x90'
    },
    sidebar: {
        enabled: true,     // Sidebar rectangle ads
        type: 'rectangle', 
        size: '300x250'
    },
    betweenGames: {
        enabled: false,    // Disabled by default for better UX
        type: 'banner',
        size: '728x90'
    }
}
```

## Real Ad Platform Setup (Future)

When ready to monetize:

1. Set `developmentMode: false`
2. Enable desired platforms:
   ```javascript
   platforms: {
       google: {
           enabled: true,
           publisherId: 'YOUR_GOOGLE_PUBLISHER_ID',
           adUnitIds: {
               banner: 'YOUR_BANNER_AD_UNIT',
               sidebar: 'YOUR_SIDEBAR_AD_UNIT'
           }
       }
   }
   ```
3. Install ad platform SDKs (Google AdSense, Facebook Audience Network, etc.)

## Summary

- **Demo Mode**: Set `enabled: false` in config.js
- **Show Fake Ads**: Set `enabled: true, developmentMode: true`
- **Real Ads**: Set `enabled: true, developmentMode: false` + configure platforms

No code changes needed - just configuration! 