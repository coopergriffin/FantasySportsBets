/**
 * Application Configuration
 * 
 * Centralizes all configuration settings for both client and server.
 * Uses environment variables with fallbacks to default values.
 */

// Load environment variables
require('dotenv').config();

// Log environment variables (without exposing sensitive data)
console.log('Loading configuration...');
console.log('Environment variables loaded:', {
  ODDS_API_KEY_SET: !!process.env.ODDS_API_KEY,
  NODE_ENV: process.env.NODE_ENV || 'development'
});

const config = {
  server: {
    port: process.env.PORT || 5000,
    database: {
      path: process.env.DB_PATH || './bets.db',
      // Add future database configuration here
    },
    auth: {
      saltRounds: 10,  // For bcrypt password hashing
      jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'your-refresh-secret-change-in-production',
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d'
    },
    odds: {
      apiKeys: [
        process.env.ODDS_API_KEY,
        process.env.ODDS_API_KEY_2,
        process.env.ODDS_API_KEY_3,
        process.env.ODDS_API_KEY_4,
        process.env.ODDS_API_KEY_5
      ].filter(key => key), // Filter out undefined/null keys
      baseUrl: 'https://api.the-odds-api.com/v4',
      region: 'us',
      markets: 'h2h',
      oddsFormat: 'american'
    },
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? 'https://your-production-domain.com' 
        : ['http://localhost:5173', 'http://localhost:5174'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Authorization'],
      credentials: true
    },
    security: {
      rateLimiting: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
      },
      helmet: {
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'https://api.the-odds-api.com']
          }
        },
        frameguard: { action: 'deny' }
      }
    }
  },
  client: {
    api: {
      baseURL: process.env.NODE_ENV === 'production'
        ? 'https://your-production-domain.com'
        : 'http://localhost:5000'
    },
    betting: {
      defaultAmount: 100,  // Default bet amount
      minimumBalance: 50   // Minimum balance required to place bets
    },
    auth: {
      tokenStorageKey: 'auth_token',
      refreshTokenStorageKey: 'refresh_token'
    }
  },
  test: {
    database: {
      path: ':memory:', // Use in-memory database for testing
    },
    auth: {
      jwtSecret: 'test-secret',
      refreshTokenSecret: 'test-refresh-secret'
    }
  }
};

/**
 * Advertisement Configuration
 * Controls ad display and platform integration
 */
const ADS_CONFIG = {
    // Global ad toggle - set to false to disable all ads
    enabled: true,
    
    // Development mode - shows fake ads instead of real ones
    developmentMode: true,
    
    // Ad platform configuration (for future real ad integration)
    platforms: {
        google: {
            enabled: false,
            publisherId: '', // Will be set when going live
            adUnitIds: {
                banner: '',
                sidebar: '',
                interstitial: ''
            }
        },
        facebook: {
            enabled: false,
            placementId: ''
        }
    },
    
    // Ad placement configuration
    placements: {
        header: {
            enabled: true,
            type: 'banner',
            size: '728x90'
        },
        sidebar: {
            enabled: true,
            type: 'rectangle',
            size: '300x250'
        },
        betweenGames: {
            enabled: false, // Disabled for better UX
            type: 'banner',
            size: '728x90'
        }
    },
    
    // Fake ad content for development/demo
    fakeAds: {
        sportsbook: [
            {
                title: "BetMGM Sportsbook",
                text: "Get $1000 Risk-Free First Bet",
                image: "https://via.placeholder.com/300x250/1a472a/ffffff?text=BetMGM",
                cta: "Claim Offer"
            },
            {
                title: "DraftKings",
                text: "Bet $5, Get $200 in Bonus Bets",
                image: "https://via.placeholder.com/300x250/f97316/ffffff?text=DraftKings",
                cta: "Sign Up Now"
            },
            {
                title: "FanDuel Sportsbook",
                text: "No Sweat First Bet up to $1000",
                image: "https://via.placeholder.com/300x250/3b82f6/ffffff?text=FanDuel",
                cta: "Get Started"
            }
        ],
        banner: [
            {
                title: "ESPN+ Sports Coverage",
                text: "Stream Live Sports & Exclusive Content",
                image: "https://via.placeholder.com/728x90/dc2626/ffffff?text=ESPN%2B",
                cta: "Subscribe"
            },
            {
                title: "Sports Analytics Pro",
                text: "Advanced Stats & Betting Insights",
                image: "https://via.placeholder.com/728x90/7c3aed/ffffff?text=Analytics+Pro",
                cta: "Try Free"
            }
        ]
    }
};

module.exports = { ...config, ads: ADS_CONFIG }; 