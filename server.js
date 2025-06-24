// Load environment variables from .env file FIRST
require('dotenv').config();

/**
 * Main server file for the Fantasy Sports Betting application
 * This file sets up the Express server, database connection, and API endpoints
 */

// Essential dependencies
const express = require('express');        // Web framework for handling HTTP requests
const sqlite3 = require('sqlite3').verbose(); // SQLite database with detailed logging
const cors = require('cors');              // Enable Cross-Origin Resource Sharing
const bcrypt = require('bcrypt');          // Password hashing library
const { check, validationResult } = require('express-validator'); // Input validation
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args)); // For making HTTP requests
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const config = require('./config');
const { 
    getApiSportKey, 
    getSupportedSports, 
    getSportConfig, 
    getMaxGamesForSport, 
    normalizeTeamName, 
    isBettingAllowed 
} = require('./sports-config');

// ============================================================================
// UNIFIED SPORTS CONFIGURATION
// ============================================================================
/**
 * Sports configuration is now centralized in sports-config.js
 * 
 * 🔧 TO ADD NEW SPORTS:
 * 1. Edit sports-config.js and add the sport to SPORTS_CONFIG
 * 2. Add API mapping in API_PROVIDERS
 * 3. Restart server - changes take effect immediately
 * 
 * 🔧 TO CHANGE API PROVIDER:
 * 1. Edit sports-config.js and change CURRENT_API_PROVIDER
 * 2. Ensure new provider has sport mappings
 * 3. Restart server
 */

// Legacy cache refresh setting (now centralized in sports-config.js)
const CACHE_REFRESH_MINUTES = 60;

// Helper function to round monetary values to 2 decimal places
const roundToTwoDecimals = (amount) => {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
};

// ============================================================================
// DATABASE AND CACHE SETUP
// ============================================================================

// Cache configuration
const CACHE_DURATION = CACHE_REFRESH_MINUTES * 60 * 1000; // Convert to milliseconds

// Cache table setup
const db = new sqlite3.Database('./bets.db', (err) => {
    if (err) console.error('Error connecting to database:', err);
    else console.log('Connected to SQLite database.');
});

// Note: Cache management is now handled directly in the database through the odds_cache table
// The previous in-memory cache functions are no longer needed since we simplified to individual sports only



/**
 * Fetches odds from the API using multiple API keys with fallback
 * @param {string} sport - Sport key to fetch odds for
 * @returns {Promise<Object>} Odds data
 */
async function fetchOddsWithFallback(sport) {
    const apiKeys = config.server.odds.apiKeys;
    console.log(`Attempting to fetch ${sport} odds with ${apiKeys.length} available API keys`);
    
    let lastError = null;
    for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = apiKeys[i];
        if (!apiKey) continue;

        try {
            const url = `${config.server.odds.baseUrl}/sports/${sport}/odds/?apiKey=${apiKey}&regions=${config.server.odds.region}&markets=${config.server.odds.markets}&oddsFormat=${config.server.odds.oddsFormat}`;
            console.log(`Fetching odds for ${sport}`);
            
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                console.log(`Successfully fetched odds for ${sport} using API key ${i + 1}`);
                return data;
            } else {
                const errorData = await response.text();
                console.log(`API key ${i + 1} failed for ${sport} with status ${response.status}: ${errorData}`);
                lastError = new Error(`API key ${i + 1} failed: ${response.status}`);
            }
        } catch (error) {
            console.log(`API key ${i + 1} failed for ${sport} with error:`, error.message);
            lastError = error;
        }
    }

    // If we get here, all API keys failed
    throw lastError || new Error('All API keys failed');
}

// Log environment setup
console.log('Environment:', process.env.NODE_ENV);
console.log('Odds API Key configured:', !!process.env.ODDS_API_KEY);
console.log(`🔑 Total API keys available: ${config.server.odds.apiKeys.length}`);
config.server.odds.apiKeys.forEach((key, index) => {
    console.log(`   API Key ${index + 1}: ${key ? '✅ Configured' : '❌ Missing'}`);
});

// Initialize Express application
const app = express();
const PORT = config.server.port;

// Middleware setup
app.use(express.json());  // Parse JSON request bodies

// CORS configuration
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Disable helmet for development
if (process.env.NODE_ENV === 'production') {
    app.use(helmet(config.server.security.helmet));
} else {
    console.log('Running in development mode - Helmet disabled');
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication token required' });
    }

    jwt.verify(token, config.server.auth.jwtSecret, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Generate JWT token
const generateAccessToken = (user) => {
    return jwt.sign(user, config.server.auth.jwtSecret, { expiresIn: '24h' });
};

// Function to fetch odds for a specific sport with simplified caching
const fetchOddsForSport = async (sportKey, sportDisplay) => {
    try {
        const maxGames = getMaxGamesForSport(sportKey);
        console.log(`Fetching odds for ${sportDisplay} (max ${maxGames} upcoming games, no time limit)`);
        
        // No time constraints - fetch all upcoming games and let API return what's available
        const now = new Date();
        const commenceTimeFrom = now.toISOString().split('.')[0] + 'Z';
        // Remove commenceTimeTo to get all future games
        
        // Use the fallback system to try multiple API keys
        const apiKeys = config.server.odds.apiKeys;
        console.log(`🔑 Trying ${apiKeys.length} available API keys for ${sportDisplay}`);
        
        let data = null;
        let lastError = null;
        
        for (let i = 0; i < apiKeys.length; i++) {
            const apiKey = apiKeys[i];
            if (!apiKey) continue;

            try {
                const apiSportKey = getApiSportKey(sportKey) || sportKey; // Use centralized mapping
                const url = `https://api.the-odds-api.com/v4/sports/${apiSportKey}/odds/?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=american&commenceTimeFrom=${commenceTimeFrom}`;
                console.log(`🔄 Trying API key ${i + 1}/${apiKeys.length} for ${sportDisplay}`);
                
                const response = await fetch(url);
                if (response.ok) {
                    data = await response.json();
                    console.log(`✅ Successfully fetched ${data.length} games for ${sportDisplay} using API key ${i + 1}`);
                    break; // Success, exit the loop
                } else {
                    const errorText = await response.text();
                    console.log(`❌ API key ${i + 1} failed for ${sportDisplay}: ${response.status} - ${errorText}`);
                    lastError = new Error(`API key ${i + 1} failed: ${response.status} - ${errorText}`);
                }
            } catch (error) {
                console.log(`❌ API key ${i + 1} error for ${sportDisplay}:`, error.message);
                lastError = error;
            }
        }
        
        if (!data) {
            console.error(`🚫 All ${apiKeys.length} API keys failed for ${sportDisplay}`);
            throw lastError || new Error(`All API keys exhausted for ${sportDisplay}`);
        }
        // Provide clear feedback about what we found
        if (data.length === 0) {
            console.log(`📭 No upcoming games found for ${sportDisplay} - no games currently scheduled`);
        } else {
            console.log(`📥 Received ${data.length} upcoming games for ${sportDisplay} (no time limit)`);
        }

        // Clear old data for this sport before inserting new data
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM odds_cache WHERE sport = ?', [sportDisplay], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Sort by commence time and only take the configured number of games
        const sortedGames = data
            .sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time))
            .slice(0, maxGames); // Use configured limit per sport

        // Insert each game into the database
        for (const game of sortedGames) {
            const odds = game.bookmakers?.[0]?.markets?.[0]?.outcomes || [];
            try {
                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO odds_cache (sport, game, home_team, away_team, commence_time, odds) 
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            sportDisplay,
                            `${game.home_team} vs ${game.away_team}`,
                            game.home_team,
                            game.away_team,
                            game.commence_time,
                            JSON.stringify(odds)
                        ],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            } catch (insertError) {
                // Log but don't fail the entire operation for duplicate entries
                console.log(`Skipping duplicate game: ${game.home_team} vs ${game.away_team}`);
            }
        }

        // 🧹 EXTRA CLEANUP: Remove any games beyond our limit (safety measure)
        await cleanupExcessGames(sportDisplay, maxGames);

        console.log(`✅ Cached ${sortedGames.length}/${maxGames} upcoming ${sportDisplay} games`);
        return sortedGames.length;
    } catch (error) {
        console.error(`Error fetching ${sportDisplay} odds:`, error);
        return 0;
    }
};

/**
 * Clean up excess games beyond the configured limit for a sport
 * This ensures we never have more than the configured number of games in cache
 * @param {string} sportDisplay - Display name of the sport (e.g., 'NFL')
 * @param {number} maxGames - Maximum number of games to keep
 */
const cleanupExcessGames = async (sportDisplay, maxGames) => {
    try {
        // Get all games for this sport, ordered by commence time
        const allGames = await new Promise((resolve, reject) => {
            db.all(
                `SELECT id FROM odds_cache 
                 WHERE sport = ? AND datetime(commence_time) > datetime('now')
                 ORDER BY datetime(commence_time) ASC`,
                [sportDisplay],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });

        // If we have more games than allowed, delete the excess
        if (allGames.length > maxGames) {
            const gamesToDelete = allGames.slice(maxGames); // Keep first maxGames, delete the rest
            const idsToDelete = gamesToDelete.map(game => game.id);
            
            console.log(`🗑️  Removing ${gamesToDelete.length} excess games from ${sportDisplay} cache (keeping only ${maxGames})`);
            
            // Delete excess games
            const placeholders = idsToDelete.map(() => '?').join(',');
            await new Promise((resolve, reject) => {
                db.run(
                    `DELETE FROM odds_cache WHERE id IN (${placeholders})`,
                    idsToDelete,
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }
    } catch (error) {
        console.error(`Error cleaning up excess games for ${sportDisplay}:`, error);
    }
};

/**
 * Get odds endpoint - simplified to only handle individual sports
 * @param {string} sport - Sport key to fetch odds for (required, no 'all' option)
 * @param {number} page - Page number to fetch
 * @param {number} limit - Number of items per page
 * @returns {Promise<Object>} Odds data for the specified sport
 */
app.get('/api/odds', authenticateToken, async (req, res) => {
    try {
        const { sport, page = 1, limit = 10, forceRefresh = 'false' } = req.query;
        const offset = (page - 1) * limit;
        
        // Validate that sport is provided (no 'all' option allowed)
        if (!sport) {
            return res.status(400).json({ message: 'Sport parameter is required' });
        }
        
        console.log(`📊 Odds request: sport=${sport}, page=${page}, forceRefresh=${forceRefresh}`);

        // Find the sport info by display name
        const supportedSports = getSupportedSports();
        const sportInfo = supportedSports.find(s => s.label === sport);
        if (!sportInfo) {
            return res.status(400).json({ message: `Unsupported sport: ${sport}` });
        }
        
        const maxGames = getMaxGamesForSport(sportInfo.value);
        
        // Check if we need fresh data for this sport
        const cacheStatus = await new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as count, MAX(created_at) as latest_update 
                 FROM odds_cache 
                 WHERE sport = ? AND datetime(commence_time) > datetime('now')`,
                [sport],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        // Determine if we need to fetch fresh data
        const isForceRefresh = forceRefresh === 'true';
        const needsFresh = isForceRefresh || 
            !cacheStatus.latest_update || 
            cacheStatus.count === 0 || 
            (Date.now() - new Date(cacheStatus.latest_update).getTime()) > CACHE_DURATION;

        if (needsFresh) {
            const refreshReason = isForceRefresh ? 'force refresh requested' : 
                cacheStatus.count === 0 ? 'no cache' : 'stale cache';
            console.log(`🔄 Fetching fresh data for ${sport} (${refreshReason}, ${cacheStatus.count}/${maxGames} games in cache)`);
            await fetchOddsForSport(sportInfo.value, sport);
        } else {
            const ageMinutes = Math.round((Date.now() - new Date(cacheStatus.latest_update).getTime()) / (1000 * 60));
            console.log(`✅ Using cached ${sport} data (${cacheStatus.count}/${maxGames} games, ${ageMinutes}m old)`);
        }

        // Get paginated results from cache for this specific sport
        const query = `SELECT * FROM odds_cache 
                      WHERE sport = ? AND datetime(commence_time) > datetime('now')
                      ORDER BY datetime(commence_time) ASC 
                      LIMIT ? OFFSET ?`;
        const countQuery = `SELECT COUNT(*) as count FROM odds_cache 
                           WHERE sport = ? AND datetime(commence_time) > datetime('now')`;

        // Get total count for this sport
        const countResult = await new Promise((resolve, reject) => {
            db.get(countQuery, [sport], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // Get paginated results for this sport
        const results = await new Promise((resolve, reject) => {
            db.all(query, [sport, parseInt(limit), offset], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Format the odds data
        const formattedResults = results.map(game => ({
            id: game.id,
            sport: game.sport,
            game: game.game,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            commenceTime: game.commence_time,
            odds: JSON.parse(game.odds)
        }));

        // Debug logging
        if (formattedResults.length > 0) {
            console.log(`📅 Returning ${formattedResults.length} ${sport} games for page ${page}:`);
            formattedResults.slice(0, 3).forEach((game, idx) => {
                const gameDate = new Date(game.commenceTime);
                const daysFromNow = Math.ceil((gameDate - new Date()) / (1000 * 60 * 60 * 24));
                console.log(`   ${idx + 1}. ${game.homeTeam} vs ${game.awayTeam} (${daysFromNow} days)`);
            });
            if (formattedResults.length > 3) {
                console.log(`   ... and ${formattedResults.length - 3} more games`);
            }
        }

        res.json({
            total: countResult.count,
            page: parseInt(page),
            totalPages: Math.ceil(countResult.count / parseInt(limit)),
            data: formattedResults
        });
    } catch (error) {
        console.error('Error fetching odds:', error);
        res.status(500).json({ message: 'Error fetching odds data' });
    }
});

/**
 * Smart startup cache initialization
 * Only fetches upcoming games and maintains reasonable cache sizes per sport
 */
const initializeOddsData = async () => {
    console.log('\n🏈 SIMPLIFIED CACHE INITIALIZATION 🏈');
    console.log('=====================================');
    console.log(`⚡ Using centralized sports configuration for all leagues`);
    console.log(`🔄 Cache refreshes every ${CACHE_REFRESH_MINUTES} minutes`);

    let totalCachedGames = 0;
    let totalFreshGames = 0;
    const cacheReport = [];

    // Clean up old games first
    console.log('🧹 Cleaning up past games from cache...');
    await new Promise((resolve, reject) => {
        db.run("DELETE FROM odds_cache WHERE datetime(commence_time) <= datetime('now')", (err) => {
            if (err) {
                console.error('Error cleaning old games:', err);
                reject(err);
            } else {
                console.log('✅ Removed past games from cache');
                resolve();
            }
        });
    });

    // 🗑️ Clean up excess games for each sport based on current limits
    console.log('🗑️  Cleaning up excess games beyond configured limits...');
    const supportedSports = getSupportedSports();
    for (const sport of supportedSports) {
        const sportKey = sport.value;
        const maxGames = getMaxGamesForSport(sportKey);
        await cleanupExcessGames(sport.label, maxGames);
    }

    for (const sport of supportedSports) {
        const sportKey = sport.value;
        const sportInfo = { display: sport.label, key: sportKey };
        try {
            const maxGames = getMaxGamesForSport(sportKey);
            
            // Check current cache status for this sport
            const cacheStatus = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(*) as count, 
                     MAX(created_at) as latest_update,
                     MIN(commence_time) as next_game
                     FROM odds_cache 
                     WHERE sport = ? AND datetime(commence_time) > datetime('now')`,
                    [sportInfo.display],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            const cachedCount = cacheStatus.count || 0;
            const lastUpdate = cacheStatus.latest_update;
            const isStale = !lastUpdate || (Date.now() - new Date(lastUpdate).getTime()) > CACHE_DURATION;

            let freshCount = 0;
            let status = '';

            if (cachedCount === 0) {
                status = '🔴 NO CACHE - Fetching upcoming games';
                freshCount = await fetchOddsForSport(sportInfo.key, sportInfo.display);
            } else if (isStale) {
                const ageMinutes = lastUpdate ? 
                    Math.round((Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60)) : 
                    'unknown';
                status = `🟡 STALE CACHE (${ageMinutes}m old) - Refreshing`;
                freshCount = await fetchOddsForSport(sportInfo.key, sportInfo.display);
            } else {
                const ageMinutes = lastUpdate ? 
                    Math.round((Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60)) : 
                    'unknown';
                status = `🟢 FRESH CACHE (${ageMinutes}m old) - Using cached data`;
                freshCount = 0;
            }

            // Get updated count after potential refresh
            const finalCount = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT COUNT(*) as count FROM odds_cache WHERE sport = ? AND datetime(commence_time) > datetime(\'now\')',
                    [sportInfo.display],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row.count || 0);
                    }
                );
            });

            cacheReport.push({
                sport: sportInfo.display,
                status,
                cachedGames: freshCount === 0 ? finalCount : cachedCount,
                freshGames: freshCount,
                totalGames: finalCount,
                maxGames: maxGames,
                nextGame: cacheStatus.next_game
            });

            if (freshCount === 0) {
                totalCachedGames += finalCount;
            } else {
                totalFreshGames += freshCount;
            }

        } catch (error) {
            console.error(`❌ Error checking ${sportInfo.display}:`, error.message);
            cacheReport.push({
                sport: sportInfo.display,
                status: '❌ ERROR - Could not check/fetch data',
                cachedGames: 0,
                freshGames: 0,
                totalGames: 0,
                maxGames: getMaxGamesForSport(sportKey),
                error: error.message
            });
        }
    }

    // Display simplified report
    console.log('\n📊 CACHE STATUS:');
    console.log('=====================================');
    
    cacheReport.forEach(report => {
        console.log(`\n🏆 ${report.sport.toUpperCase()}:`);
        console.log(`   Status: ${report.status}`);
        console.log(`   Games Available: ${report.totalGames}/${report.maxGames} (limited for efficiency)`);
        if (report.freshGames > 0) {
            console.log(`   🔄 Fresh from API: ${report.freshGames}`);
        }
        if (report.cachedGames > 0 && report.freshGames === 0) {
            console.log(`   💾 From Cache: ${report.cachedGames}`);
        }
        if (report.nextGame) {
            const nextGameDate = new Date(report.nextGame);
            const daysFromNow = Math.ceil((nextGameDate - new Date()) / (1000 * 60 * 60 * 24));
            console.log(`   🕐 Next Game: ${nextGameDate.toLocaleDateString()} (${daysFromNow} days)`);
        }
        if (report.error) {
            console.log(`   ⚠️  Error: ${report.error}`);
        }
    });

    console.log('\n📈 SUMMARY:');
    console.log('=====================================');
    console.log(`💾 Games served from cache: ${totalCachedGames}`);
    console.log(`🔄 Games fetched fresh from API: ${totalFreshGames}`);
    console.log(`🎯 Total upcoming games available: ${totalCachedGames + totalFreshGames}`);
    console.log(`⚡ Games per sport limited by individual sport configurations to conserve API calls`);
    
    if (totalFreshGames > 0) {
        console.log(`📡 API calls made: ${cacheReport.filter(r => r.freshGames > 0).length}`);
    }
    
    console.log('=====================================\n');
};

/**
 * Initialize database schema
 * Creates tables if they don't exist and adds test users
 */
db.serialize(() => {
    // Create users table if it doesn't exist
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            email TEXT,
            balance REAL DEFAULT 1000.00,
            created_at DATETIME DEFAULT (datetime('now', 'utc')),
            timezone TEXT DEFAULT 'America/New_York'
        )
    `);

    // Create bets table with game_date column if it doesn't exist
    db.run(`
        CREATE TABLE IF NOT EXISTS bets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            game TEXT,
            team TEXT,
            amount REAL,
            odds INTEGER,
            sport TEXT,
            status TEXT DEFAULT 'pending',
            game_date TEXT,
            created_at DATETIME DEFAULT (datetime('now', 'utc')),
            status_changed_at DATETIME DEFAULT NULL,
            final_amount REAL DEFAULT NULL,
            profit_loss REAL DEFAULT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Add new columns to existing users table if they don't exist
    db.run(`
        ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'America/New_York'
    `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding timezone column:', err);
        }
    });

    // Add new columns to existing bets table if they don't exist
    db.run(`
        ALTER TABLE bets ADD COLUMN status_changed_at DATETIME DEFAULT NULL
    `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding status_changed_at column:', err);
        }
    });

    db.run(`
        ALTER TABLE bets ADD COLUMN final_amount REAL DEFAULT NULL
    `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding final_amount column:', err);
        }
    });

    db.run(`
        ALTER TABLE bets ADD COLUMN profit_loss REAL DEFAULT NULL
    `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error('Error adding profit_loss column:', err);
        }
    });

    // Create odds cache table with unique constraint to prevent duplicates
    db.run(`
        CREATE TABLE IF NOT EXISTS odds_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sport TEXT,
            game TEXT,
            home_team TEXT,
            away_team TEXT,
            commence_time TEXT,
            odds TEXT,
            created_at DATETIME DEFAULT (datetime('now', 'utc')),
            UNIQUE(sport, home_team, away_team, commence_time)
        )
    `);

    console.log('Connected to SQLite database.');
    console.log('Odds cache table ready');

    console.log('Database initialized successfully');

    // Initialize odds data with comprehensive reporting
    setTimeout(() => {
        initializeOddsData().catch(error => {
            console.error('Error during odds initialization:', error);
        });
    }, 1000); // Small delay to ensure database is fully ready
});

/**
 * Registration validation middleware
 * Defines rules for username, password, and email validation
 */
const registerValidation = [
    check('username').trim().isLength({ min: 3 }).escape(),
    check('password').isLength({ min: 6 }),
    check('email').isEmail().normalizeEmail()
];

/**
 * User Registration Endpoint
 * Creates a new user account with validation and security measures
 */
app.post('/register', async (req, res) => {
    try {
        const { username, password, email } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required' });
        }

        // Validate email format if provided
        if (email && !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        // Check if username already exists
        db.get('SELECT id FROM users WHERE username = ?', [username], async (err, user) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Error checking username' });
            }
            if (user) {
                return res.status(400).json({ message: 'Username already exists' });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user
            db.run(
                'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
                [username, hashedPassword, email || null],
                function(err) {
                    if (err) {
                        console.error('Error creating user:', err);
                        return res.status(500).json({ message: 'Error creating user' });
                    }

                    // Generate token
                    const token = generateAccessToken({ userId: this.lastID });

                    // Return success with token
                    res.status(201).json({
                        message: 'User registered successfully',
                        token,
                        userId: this.lastID
                    });
                }
            );
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Error during registration' });
    }
});

/**
 * Login endpoint
 * Authenticates user and returns JWT token
 */
app.post('/login', [
    check('username').trim().notEmpty(),
    check('password').trim().notEmpty()
], async (req, res) => {
    console.log('Login attempt for username:', req.body.username);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ error: "Username and password are required" });
    }

    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
            console.error('Database error during login:', err);
            return res.status(500).json({ error: "Server error" });
        }
        
        if (!user) {
            console.log('User not found:', username);
            return res.status(401).json({ error: "Invalid credentials" });
        }

        try {
            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                console.log('Password mismatch for user:', username);
                return res.status(401).json({ error: "Invalid credentials" });
            }

            // Generate JWT token with user ID
            const token = generateAccessToken({ userId: user.id });
            
            // Send user data without sensitive information
            const userData = {
                id: user.id,
                username: user.username,
                email: user.email,
                balance: roundToTwoDecimals(user.balance),
                created_at: user.created_at
            };

            console.log('Successful login for user:', username);
            res.json({
                user: userData,
                token: token
            });
        } catch (error) {
            console.error('Error during password comparison:', error);
            res.status(500).json({ error: "Server error during authentication" });
        }
    });
});

/**
 * Get Current User Profile Endpoint
 * Returns current user's profile information including timezone
 */
app.get('/user', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    
    db.get('SELECT id, username, email, balance, timezone, created_at FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            console.error('Database error fetching user:', err);
            return res.status(500).json({ error: 'Failed to fetch user data' });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Round balance to 2 decimal places for display
        user.balance = roundToTwoDecimals(user.balance);
        
        res.json(user);
    });
});

/**
 * Update User Timezone Endpoint
 * Updates the user's timezone preference
 */
app.put('/user/timezone', authenticateToken, [
    check('timezone').notEmpty().withMessage('Timezone is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.userId;
    const { timezone } = req.body;

    // List of common valid timezones
    const validTimezones = [
        'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
        'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
        'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Rome',
        'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney',
        'UTC'
    ];

    if (!validTimezones.includes(timezone)) {
        return res.status(400).json({ error: 'Invalid timezone' });
    }

    db.run(
        'UPDATE users SET timezone = ? WHERE id = ?',
        [timezone, userId],
        function(err) {
            if (err) {
                console.error('Error updating timezone:', err);
                return res.status(500).json({ error: 'Failed to update timezone' });
            }

            res.json({
                success: true,
                message: 'Timezone updated successfully',
                timezone: timezone
            });
        }
    );
});

/**
 * Fetches fresh odds for a specific game during betting operations
 * This bypasses cache to ensure we have the most current odds for bet placement/selling
 * @param {string} sport - Sport key (e.g., 'NFL', 'NBA')
 * @param {string} homeTeam - Home team name
 * @param {string} awayTeam - Away team name
 * @returns {Promise<Object|null>} Fresh odds data or null if not found
 */
const fetchFreshOddsForGame = async (sport, homeTeam, awayTeam) => {
    try {
        console.log(`🔄 Fetching fresh odds for betting operation: ${homeTeam} vs ${awayTeam} (${sport})`);
        
        // Get sport configuration by finding the API sport key
        const supportedSports = getSupportedSports();
        const sportInfo = supportedSports.find(s => s.label === sport);
        if (!sportInfo) {
            console.log(`❌ Sport configuration not found for: ${sport}`);
            return null;
        }
        const apiSportKey = getApiSportKey(sportInfo.value);

        const apiKeys = config.server.odds.apiKeys;
        console.log(`🔑 Using ${apiKeys.length} API keys for fresh odds verification`);
        
        let data = null;
        let lastError = null;
        
        // Try each API key until we get data
        for (let i = 0; i < apiKeys.length; i++) {
            const apiKey = apiKeys[i];
            if (!apiKey) continue;

            try {
                const now = new Date();
                const commenceTimeFrom = now.toISOString().split('.')[0] + 'Z';
                const url = `https://api.the-odds-api.com/v4/sports/${apiSportKey}/odds/?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=american&commenceTimeFrom=${commenceTimeFrom}`;
                
                console.log(`🔄 Trying API key ${i + 1}/${apiKeys.length} for fresh odds verification`);
                
                const response = await fetch(url);
                if (response.ok) {
                    const allGames = await response.json();
                    console.log(`✅ Retrieved ${allGames.length} games for fresh verification`);
                    
                    // Find the specific game by team names
                    const targetGame = allGames.find(game => 
                        (game.home_team === homeTeam && game.away_team === awayTeam) ||
                        (game.home_team === awayTeam && game.away_team === homeTeam) ||
                        (game.home_team.includes(homeTeam) || homeTeam.includes(game.home_team)) &&
                        (game.away_team.includes(awayTeam) || awayTeam.includes(game.away_team))
                    );
                    
                    if (targetGame) {
                        console.log(`✅ Found fresh odds for ${targetGame.home_team} vs ${targetGame.away_team}`);
                        
                        // Update cache with fresh data for this specific game
                        const odds = targetGame.bookmakers?.[0]?.markets?.[0]?.outcomes || [];
                        
                        // Delete old cache entry for this game
                        await new Promise((resolve, reject) => {
                            db.run(
                                'DELETE FROM odds_cache WHERE sport = ? AND (home_team = ? OR away_team = ?) AND (home_team = ? OR away_team = ?)',
                                [sport, homeTeam, homeTeam, awayTeam, awayTeam],
                                (err) => {
                                    if (err) reject(err);
                                    else resolve();
                                }
                            );
                        });
                        
                        // Insert fresh data
                        await new Promise((resolve, reject) => {
                            db.run(
                                `INSERT INTO odds_cache (sport, game, home_team, away_team, commence_time, odds, created_at) 
                                 VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'utc'))`,
                                [
                                    sport,
                                    `${targetGame.home_team} vs ${targetGame.away_team}`,
                                    targetGame.home_team,
                                    targetGame.away_team,
                                    targetGame.commence_time,
                                    JSON.stringify(odds)
                                ],
                                (err) => {
                                    if (err) reject(err);
                                    else resolve();
                                }
                            );
                        });
                        
                        console.log(`✅ Updated cache with fresh odds for betting operation`);
                        return {
                            game: targetGame,
                            odds: odds
                        };
                    } else {
                        console.log(`⚠️  Game not found in fresh API data: ${homeTeam} vs ${awayTeam}`);
                    }
                    
                    break; // Success with API call, even if game not found
                } else {
                    const errorText = await response.text();
                    console.log(`❌ API key ${i + 1} failed: ${response.status} - ${errorText}`);
                    lastError = new Error(`API key ${i + 1} failed: ${response.status}`);
                }
            } catch (error) {
                console.log(`❌ API key ${i + 1} error:`, error.message);
                lastError = error;
            }
        }
        
        if (!data) {
            console.log(`⚠️  Could not fetch fresh odds (all API keys failed), using cached data for ${homeTeam} vs ${awayTeam}`);
        }
        
        return null;
    } catch (error) {
        console.error(`❌ Error fetching fresh odds for ${homeTeam} vs ${awayTeam}:`, error);
        return null;
    }
};

/**
 * Verifies and updates odds for a specific game during betting operations
 * @param {string} sport - Sport name
 * @param {string} game - Game description (e.g., "Team A vs Team B")
 * @returns {Promise<Object|null>} Current odds data or null
 */
const verifyOddsForBetting = async (sport, game) => {
    try {
        // Parse team names from game string
        const teams = game.split(' vs ');
        if (teams.length !== 2) {
            console.log(`⚠️  Could not parse team names from: ${game}`);
            return null;
        }
        
        const [team1, team2] = teams.map(t => t.trim());
        
        // Try to fetch fresh odds
        const freshOdds = await fetchFreshOddsForGame(sport, team1, team2);
        if (freshOdds) {
            return freshOdds.odds;
        }
        
        // Fallback to cached data if fresh fetch fails
        console.log(`📦 Using cached odds as fallback for ${game}`);
        const cachedOdds = await new Promise((resolve, reject) => {
            db.get(
                "SELECT odds FROM odds_cache WHERE game = ? AND sport = ? ORDER BY created_at DESC LIMIT 1",
                [game, sport],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
        
        if (cachedOdds && cachedOdds.odds) {
            return JSON.parse(cachedOdds.odds);
        }
        
        return null;
    } catch (error) {
        console.error(`Error verifying odds for betting:`, error);
        return null;
    }
};

/**
 * Place Bet Endpoint
 * Handles bet placement and balance updates with fresh odds verification
 */
app.post('/api/bets', authenticateToken, async (req, res) => {
    const { game, team, amount, odds, sport, game_date } = req.body;
    const userId = req.user.userId;

    try {
        console.log('Attempting to place bet:', {
            userId,
            game,
            team,
            amount,
            odds,
            sport,
            game_date
        });

        // Check if betting is still allowed for this sport and game time
        if (!isBettingAllowed(game_date, sport)) {
            const sportConfig = getSportConfig(sport);
            const cutoffMinutes = sportConfig ? sportConfig.minBetCutoff : 15;
            return res.status(400).json({ 
                message: `Cannot place bet - game starts in less than ${cutoffMinutes} minutes` 
            });
        }

        // 🔄 VERIFY CURRENT ODDS FOR BETTING OPERATION
        console.log(`🔍 Verifying current odds for bet placement...`);
        const currentOddsData = await verifyOddsForBetting(sport, game);
        
        if (currentOddsData && currentOddsData.length > 0) {
            // Find the odds for the selected team
            const teamOdds = currentOddsData.find(odd => 
                odd.name === team || 
                (team && team.includes(odd.name)) || 
                (odd.name && odd.name.includes(team))
            );
            
            if (teamOdds) {
                const oddsVerified = teamOdds.price;
                const oddsDifference = Math.abs(odds - oddsVerified);
                
                console.log(`📊 Odds verification: Original ${odds}, Current ${oddsVerified}, Difference: ${oddsDifference}`);
                
                // If odds have changed significantly (more than 10 points), reject the bet
                if (oddsDifference > 10) {
                    console.log(`❌ Odds have changed significantly! Rejecting bet.`);
                    return res.status(400).json({ 
                        message: 'Odds have changed significantly',
                        originalOdds: odds,
                        currentOdds: oddsVerified,
                        difference: oddsDifference
                    });
                } else {
                    console.log(`✅ Odds verification passed (difference: ${oddsDifference} points)`);
                }
            } else {
                console.log(`⚠️  Could not find odds for team ${team}, proceeding with original odds`);
            }
        } else {
            console.log(`⚠️  Could not verify current odds, proceeding with original odds`);
        }

        // Start a transaction
        await db.run('BEGIN TRANSACTION');

        // Check user balance
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user || user.balance < amount) {
            await db.run('ROLLBACK');
            return res.status(400).json({ message: 'Insufficient balance' });
        }

        // Round amount to 2 decimal places
        const roundedAmount = roundToTwoDecimals(amount);

        // Place bet and update balance
        await db.run(
            'INSERT INTO bets (user_id, game, team, amount, odds, sport, game_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime(\'now\', \'utc\'))',
            [userId, game, team, roundedAmount, odds, sport, game_date]
        );

        await db.run(
            'UPDATE users SET balance = ROUND(balance - ?, 2) WHERE id = ?',
            [roundedAmount, userId]
        );

        // Commit transaction
        await db.run('COMMIT');

        // Get updated balance
        const updatedUser = await new Promise((resolve, reject) => {
            db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        res.json({
            success: true,
            message: 'Bet placed successfully',
            newBalance: roundToTwoDecimals(updatedUser.balance)
        });
    } catch (error) {
        console.error('Error placing bet:', error);
        await db.run('ROLLBACK');
        res.status(500).json({ message: 'Error placing bet' });
    }
});

/**
 * Get User Bets Endpoint
 * Retrieves betting history for a specific user with timezone-formatted timestamps
 */
app.get('/bets/:userId', authenticateToken, (req, res) => {
    const { userId } = req.params;
    
    // Log authentication info
    console.log('Auth debug:', {
        requestUserId: userId,
        tokenUserId: req.user.userId,
        token: req.headers.authorization
    });

    // Ensure users can only access their own bets
    if (parseInt(userId) !== parseInt(req.user.userId)) {
        console.log('Access denied: userId mismatch', {
            requestUserId: userId,
            tokenUserId: req.user.userId
        });
        return res.status(403).json({ error: "Access denied" });
    }

    // Log the user ID for debugging
    console.log('Fetching bets for user:', userId);

    // First get user's timezone preference
    db.get('SELECT timezone FROM users WHERE id = ?', [userId], (err, userInfo) => {
        if (err) {
            console.error('Error fetching user timezone:', err);
            return res.status(500).json({ error: "Failed to fetch user info" });
        }

        const userTimezone = userInfo?.timezone || 'America/New_York';

        // Then get all bets for the user
        db.all(
            "SELECT * FROM bets WHERE user_id = ? ORDER BY created_at DESC",
            [userId],
            (err, rows) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: "Failed to fetch betting history" });
                }
                console.log('Bets found:', rows ? rows.length : 0);
                
                // Process bets and format timestamps
                const processedBets = rows.map(bet => {
                    const formattedCreatedAt = formatTimestampForUser(bet.created_at, userTimezone);
                    const formattedStatusChangedAt = bet.status_changed_at ? 
                        formatTimestampForUser(bet.status_changed_at, userTimezone) : null;
                    const formattedGameDate = bet.game_date ? 
                        formatTimestampForUser(bet.game_date, userTimezone) : null;

                    return {
                        ...bet,
                        status: bet.status || bet.outcome || 'pending',
                        created_at_formatted: formattedCreatedAt,
                        status_changed_at_formatted: formattedStatusChangedAt,
                        game_date_formatted: formattedGameDate,
                        user_timezone: userTimezone
                    };
                });
                
                res.json(processedBets || []);
            }
        );
    });
});

/**
 * Get Sell Quote Endpoint
 * Returns the current sell value for a bet without actually selling it
 */
app.get('/sell-quote/:betId', authenticateToken, async (req, res) => {
    const { betId } = req.params;
    const userId = req.user.userId;

    try {
        // Get the bet details
        const bet = await new Promise((resolve, reject) => {
            db.get(
                "SELECT * FROM bets WHERE id = ? AND user_id = ? AND status = 'pending'",
                [betId, userId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!bet) {
            return res.status(404).json({ error: "Bet not found or not eligible for sale" });
        }

        // Check if betting is still allowed for this sport
        if (!isBettingAllowed(bet.game_date, bet.sport)) {
            const sportConfig = getSportConfig(bet.sport);
            const cutoffMinutes = sportConfig ? sportConfig.minBetCutoff : 15;
            return res.status(400).json({ 
                error: `Cannot sell bet - game starts in less than ${cutoffMinutes} minutes or has already started` 
            });
        }

        console.log('🔍 Getting sell quote for bet selling...');

        // Get fresh odds for the bet using the same method as betting verification
        const currentOddsData = await verifyOddsForBetting(bet.sport, bet.game);
        
        if (!currentOddsData || currentOddsData.length === 0) {
            return res.status(400).json({ error: "Unable to get current odds for this game" });
        }

        console.log('✅ Retrieved fresh odds for sell quote');

        // Find current odds for the team
        const teamOdds = currentOddsData.find(odd => 
            odd.name === bet.team || 
            (bet.team && bet.team.includes(odd.name)) || 
            (odd.name && odd.name.includes(bet.team))
        );

        if (!teamOdds) {
            return res.status(400).json({ error: "Current odds not available for this team" });
        }

        const currentOdds = teamOdds.price;
        console.log(`✅ Found fresh odds for team ${bet.team}: ${currentOdds}`);

        // Calculate sell value using real sportsbook cash out logic
        // Formula: Cash Out Value = (Potential Payout × Current Win Probability) - House Margin
        
        // Calculate what the original bet's potential payout would be
        const originalPayout = bet.odds > 0 ?
            bet.amount + (bet.amount * bet.odds / 100) :
            bet.amount + (bet.amount * 100 / Math.abs(bet.odds));
        
        // Calculate current win probability from current odds  
        const currentWinProbability = currentOdds > 0 ? 
            100 / (currentOdds + 100) : 
            Math.abs(currentOdds) / (Math.abs(currentOdds) + 100);
        
        // Fair cash out value = potential payout * current win probability
        // This answers: "What is this bet position worth in the current market?"
        const fairCashOutValue = originalPayout * currentWinProbability;
        
        // Use fair market value directly - no artificial house edge
        let sellValue = fairCashOutValue;
        
        // Ensure minimum value (don't go below 5% of original bet)
        sellValue = Math.max(sellValue, bet.amount * 0.05);

        const profitLoss = sellValue - bet.amount;

        // Calculate minutes until game for display
        const gameTime = new Date(bet.game_date);
        const now = new Date();
        const minutesUntilGame = (gameTime - now) / (1000 * 60);

        res.json({
            success: true,
            bet: {
                id: bet.id,
                game: bet.game,
                team: bet.team,
                amount: bet.amount,
                originalOdds: bet.odds
            },
            quote: {
                sellValue: roundToTwoDecimals(sellValue),
                profitLoss: roundToTwoDecimals(profitLoss),
                currentOdds: currentOdds,
                minutesUntilGame: Math.round(minutesUntilGame)
            }
        });

    } catch (error) {
        console.error('Error getting sell quote:', error);
        res.status(500).json({ error: 'Failed to get sell quote' });
    }
});

/**
 * Sell Bet Endpoint
 * Allows users to sell their bets back based on current odds vs original odds
 * Users gain or lose money based on how the odds have changed
 */
app.post('/sell-bet/:betId', authenticateToken, async (req, res) => {
    const betId = req.params.betId;
    const userId = req.user.userId;

    try {
        // Get the bet details
        db.get(
            "SELECT * FROM bets WHERE id = ? AND user_id = ?",
            [betId, userId],
            async (err, bet) => {
                if (err) {
                    console.error('Error fetching bet:', err);
                    return res.status(500).json({ error: "Server error" });
                }

                if (!bet) {
                    return res.status(404).json({ error: "Bet not found" });
                }

                if (bet.status !== 'pending') {
                    return res.status(400).json({ error: "Can only sell pending bets" });
                }

                // Check if game has started
                const gameDate = new Date(bet.game_date);
                if (gameDate < new Date()) {
                    return res.status(400).json({ error: "Cannot sell bet after game has started" });
                }

                // 🔄 VERIFY CURRENT ODDS FOR SELLING OPERATION
                console.log(`🔍 Verifying current odds for bet selling...`);
                let currentOdds = null;
                
                try {
                    // First try to get fresh odds
                    const currentOddsData = await verifyOddsForBetting(bet.sport, bet.game);
                    
                    if (currentOddsData && currentOddsData.length > 0) {
                        console.log(`✅ Retrieved fresh odds for sell operation`);
                        
                        // Try to match by team name
                        if (bet.team && typeof bet.team === 'string') {
                            const teamOdds = currentOddsData.find(odd => 
                                odd.name === bet.team || 
                                (bet.team && bet.team.includes(odd.name)) || 
                                (odd.name && odd.name.includes(bet.team))
                            );
                            
                            if (teamOdds) {
                                currentOdds = teamOdds.price;
                                console.log(`✅ Found fresh odds for team ${bet.team}: ${currentOdds}`);
                            }
                        }
                        
                        // Fallback: match by closest odds value
                        if (!currentOdds) {
                            const closestOdds = currentOddsData.find(odd => Math.abs(odd.price - bet.odds) < 50) || currentOddsData[0];
                            if (closestOdds) {
                                currentOdds = closestOdds.price;
                                console.log(`✅ Using closest odds match: ${currentOdds}`);
                            }
                        }
                    } else {
                        console.log(`⚠️  Could not get fresh odds, falling back to cached data`);
                        
                        // Fallback to cached data
                        const oddsResult = await new Promise((resolve, reject) => {
                            db.get(
                                "SELECT odds, home_team, away_team FROM odds_cache WHERE game = ? ORDER BY created_at DESC LIMIT 1",
                                [bet.game],
                                (err, row) => {
                                    if (err) reject(err);
                                    else resolve(row);
                                }
                            );
                        });

                        if (oddsResult && oddsResult.odds) {
                            const oddsData = JSON.parse(oddsResult.odds);
                            
                            // Try to match by team name
                            if (bet.team && typeof bet.team === 'string') {
                                const teamOdds = oddsData.find(odd => 
                                    odd.name === bet.team || 
                                    (bet.team && bet.team.includes(odd.name)) || 
                                    (odd.name && odd.name.includes(bet.team))
                                );
                                
                                if (teamOdds) {
                                    currentOdds = teamOdds.price;
                                }
                            }
                            
                            // Fallback: match by closest odds value
                            if (!currentOdds) {
                                const closestOdds = oddsData.find(odd => Math.abs(odd.price - bet.odds) < 50) || oddsData[0];
                                if (closestOdds) {
                                    currentOdds = closestOdds.price;
                                }
                            }
                        }
                    }
                } catch (oddsError) {
                    console.log('Could not fetch current odds, using original odds:', oddsError.message);
                }

                // Calculate sell back value based on odds change
                let sellValue = bet.amount; // Default to original amount if no current odds
                let profitLoss = 0;
                let oddsChange = "No odds change detected";

                console.log(`Sell bet analysis for bet ${betId}:`);
                console.log(`Bet team: ${bet.team || 'Not specified'}`);
                console.log(`Original odds: ${bet.odds}, Current odds: ${currentOdds}`);

                // Calculate sell value using real sportsbook cash out logic
                if (currentOdds !== null) {
                    // Calculate what the original bet's potential payout would be
                    const originalPayout = bet.odds > 0 ?
                        bet.amount + (bet.amount * bet.odds / 100) :
                        bet.amount + (bet.amount * 100 / Math.abs(bet.odds));
                    
                    // Calculate current win probability from current odds  
                    const currentWinProbability = currentOdds > 0 ? 
                        100 / (currentOdds + 100) : 
                        Math.abs(currentOdds) / (Math.abs(currentOdds) + 100);
                    
                    // Fair cash out value = potential payout * current win probability
                    // This answers: "What is this bet position worth in the current market?"
                    const fairCashOutValue = originalPayout * currentWinProbability;
                    
                    // Use fair market value directly - no artificial house edge
                    sellValue = fairCashOutValue;
                    
                    // Ensure minimum value (don't go below 5% of original bet)
                    sellValue = Math.max(sellValue, bet.amount * 0.05);
                    
                    console.log(`Original potential payout: $${originalPayout.toFixed(2)}`);
                    console.log(`Current win probability: ${(currentWinProbability * 100).toFixed(1)}%`);
                    console.log(`Fair cash out value: $${fairCashOutValue.toFixed(2)}`);
                    console.log(`Final sell value (fair market value): $${sellValue.toFixed(2)}`);
                    
                    const oddsMovement = currentOdds - bet.odds;
                    if (Math.abs(oddsMovement) <= 5) {
                        oddsChange = "No significant odds change";
                    } else if (oddsMovement > 0) {
                        oddsChange = `Odds moved against you (+${oddsMovement})`;
                    } else {
                        oddsChange = `Odds moved in your favor (${oddsMovement})`;
                    }
                } else {
                    // No current odds available - return original amount
                    sellValue = bet.amount;
                    oddsChange = "Current odds unavailable - returning original amount";
                    console.log(`Current odds unavailable - returning original amount: $${sellValue}`);
                }
                
                profitLoss = sellValue - bet.amount;

                console.log(`Final sell value: ${sellValue.toFixed(2)}`);
                console.log(`Final profit/loss: ${profitLoss.toFixed(2)}`);

                // Round to 2 decimal places using helper function
                sellValue = roundToTwoDecimals(sellValue);
                profitLoss = roundToTwoDecimals(profitLoss);

                // Start a transaction to update user balance and update bet status
                try {
                    await new Promise((resolve, reject) => {
                        db.run("BEGIN TRANSACTION", (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });

                    // Update user's balance
                    await new Promise((resolve, reject) => {
                        db.run(
                            "UPDATE users SET balance = ROUND(balance + ?, 2) WHERE id = ?",
                            [sellValue, userId],
                            (err) => {
                                if (err) {
                                    console.error('Error updating user balance:', err);
                                    reject(err);
                                } else {
                                    console.log(`✅ Updated user ${userId} balance by $${sellValue}`);
                                    resolve();
                                }
                            }
                        );
                    });

                    // Mark bet as sold with timestamp and resolution details
                    await new Promise((resolve, reject) => {
                        db.run(
                            "UPDATE bets SET status = 'sold', status_changed_at = datetime('now', 'utc'), final_amount = ?, profit_loss = ? WHERE id = ? AND user_id = ?",
                            [sellValue, profitLoss, betId, userId],
                            (err) => {
                                if (err) {
                                    console.error('Error updating bet status:', err);
                                    reject(err);
                                } else {
                                    console.log(`✅ Updated bet ${betId} status to sold`);
                                    resolve();
                                }
                            }
                        );
                    });

                    // Commit the transaction
                    await new Promise((resolve, reject) => {
                        db.run("COMMIT", (err) => {
                            if (err) {
                                console.error('Error committing transaction:', err);
                                reject(err);
                            } else {
                                console.log('✅ Transaction committed successfully');
                                resolve();
                            }
                        });
                    });
                    
                    console.log(`✅ Bet ${betId} sold successfully for $${sellValue}`);
                    res.json({ 
                        success: true,
                        message: "Bet sold successfully",
                        sellValue: sellValue,
                        originalAmount: bet.amount,
                        profitLoss: profitLoss,
                        originalOdds: bet.odds,
                        currentOdds: currentOdds,
                        oddsChange: oddsChange
                    });
                } catch (error) {
                    // Rollback on error
                    console.error('Transaction error:', error);
                    try {
                        await new Promise((resolve, reject) => {
                            db.run("ROLLBACK", (err) => {
                                if (err) {
                                    console.error('Error rolling back transaction:', err);
                                    reject(err);
                                } else {
                                    console.log('🔄 Transaction rolled back');
                                    resolve();
                                }
                            });
                        });
                    } catch (rollbackError) {
                        console.error('Failed to rollback transaction:', rollbackError);
                    }
                    res.status(500).json({ error: "Failed to sell bet: " + error.message });
                }
            }
        );
    } catch (error) {
        console.error('Error selling bet:', error);
        res.status(500).json({ error: "Server error" });
    }
});

/**
 * Leaderboard Endpoint
 * Returns a list of users sorted by their balance
 */
app.get('/leaderboard', authenticateToken, (req, res) => {
    db.all(
        "SELECT id, username, balance FROM users ORDER BY balance DESC",
        [],
        (err, users) => {
            if (err) {
                console.error('Error fetching leaderboard:', err);
                return res.status(500).json({ error: "Server error" });
            }
            res.json({ users });
        }
    );
});

/**
 * Auto-resolve completed games endpoint
 * Checks for games that have finished and automatically resolves pending bets
 */
app.post('/api/resolve-completed-games', authenticateToken, async (req, res) => {
    try {
        console.log('🔍 Checking for completed games to auto-resolve...');
        
        // Find all pending bets for games that have already started (past commence_time)
        const completedGameBets = await new Promise((resolve, reject) => {
            db.all(`
                SELECT DISTINCT game, sport, game_date 
                FROM bets 
                WHERE status = 'pending' 
                AND datetime(game_date) < datetime('now', '-2 hours')
                ORDER BY game_date DESC
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        console.log(`📊 Found ${completedGameBets.length} games that may be completed`);
        
        let resolvedGames = 0;
        const gameResults = [];

        for (const gameInfo of completedGameBets) {
            const timeSinceGame = (new Date() - new Date(gameInfo.game_date)) / (1000 * 60 * 60); // hours
            
            // Only auto-resolve games that finished more than 2 hours ago
            if (timeSinceGame > 2) {
                console.log(`⚽ Processing completed game: ${gameInfo.game} (${timeSinceGame.toFixed(1)}h ago)`);
                
                // Get all pending bets for this game
                const gameBets = await new Promise((resolve, reject) => {
                    db.all(`
                        SELECT id, user_id, team, amount, odds 
                        FROM bets 
                        WHERE game = ? AND status = 'pending'
                    `, [gameInfo.game], (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });

                if (gameBets.length > 0) {
                    // Fetch actual game results from the API
                    let gameWinner = null;
                    let actualScore = null;
                    
                    try {
                        console.log(`🔍 Fetching actual results for completed game: ${gameInfo.game}`);
                        
                        // Parse team names from the game string
                        const gameMatch = gameInfo.game.match(/^(.+?) vs (.+?)$/);
                        if (!gameMatch) {
                            throw new Error(`Cannot parse team names from game: ${gameInfo.game}`);
                        }
                        
                        const [, homeTeam, awayTeam] = gameMatch;
                        console.log(`🏟️  Looking for results: ${homeTeam} vs ${awayTeam}`);
                        
                        // Determine sport from game info
                        const sport = gameInfo.sport;
                        const supportedSports = getSupportedSports();
                        const sportInfo = supportedSports.find(s => s.label === sport);
                        
                        if (!sportInfo) {
                            throw new Error(`Unknown sport: ${sport}`);
                        }
                        const sportKey = getApiSportKey(sportInfo.value);
                        
                        // Fetch completed games from the API with scores
                        let gameResult = null;
                        for (let i = 0; i < apiKeys.length; i++) {
                            try {
                                console.log(`🔄 Trying API key ${i + 1}/${apiKeys.length} for completed game results`);
                                
                                // Fetch completed games with scores
                                const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/scores/?apiKey=${apiKeys[i]}&daysFrom=3&daysTo=1`;
                                const response = await fetch(url);
                                
                                if (!response.ok) {
                                    console.log(`❌ API key ${i + 1} failed with status ${response.status}`);
                                    if (i === apiKeys.length - 1) {
                                        throw new Error(`All API keys failed. Last status: ${response.status}`);
                                    }
                                    continue;
                                }
                                
                                const completedGames = await response.json();
                                console.log(`✅ Retrieved ${completedGames.length} completed games from API`);
                                
                                // Find the matching game
                                gameResult = completedGames.find(game => {
                                    const gameHomeTeam = game.home_team;
                                    const gameAwayTeam = game.away_team;
                                    
                                    // Try exact match first
                                    if ((gameHomeTeam === homeTeam && gameAwayTeam === awayTeam) ||
                                        (gameHomeTeam === awayTeam && gameAwayTeam === homeTeam)) {
                                        return true;
                                    }
                                    
                                    // Try partial match (in case of slight name differences)
                                    const homeMatch = gameHomeTeam.toLowerCase().includes(homeTeam.toLowerCase()) ||
                                                     homeTeam.toLowerCase().includes(gameHomeTeam.toLowerCase());
                                    const awayMatch = gameAwayTeam.toLowerCase().includes(awayTeam.toLowerCase()) ||
                                                     awayTeam.toLowerCase().includes(gameAwayTeam.toLowerCase());
                                                     
                                    return (homeMatch && awayMatch);
                                });
                                
                                if (gameResult) {
                                    console.log(`🎯 Found matching completed game:`, {
                                        game: `${gameResult.home_team} vs ${gameResult.away_team}`,
                                        completed: gameResult.completed,
                                        scores: gameResult.scores
                                    });
                                    break;
                                }
                                
                                break; // Exit API key loop on successful response, even if no game found
                                
                            } catch (apiError) {
                                console.log(`❌ API key ${i + 1} error:`, apiError.message);
                                if (i === apiKeys.length - 1) {
                                    throw apiError;
                                }
                            }
                        }
                        
                        // Determine winner from actual game results
                        if (gameResult && gameResult.completed && gameResult.scores && gameResult.scores.length >= 2) {
                            const homeScore = gameResult.scores.find(score => score.name === gameResult.home_team);
                            const awayScore = gameResult.scores.find(score => score.name === gameResult.away_team);
                            
                            if (homeScore && awayScore && homeScore.score !== null && awayScore.score !== null) {
                                const actualWinner = homeScore.score > awayScore.score ? gameResult.home_team : gameResult.away_team;
                                actualScore = `${gameResult.home_team} ${homeScore.score} - ${awayScore.score} ${gameResult.away_team}`;
                                
                                // Map the API result winner to our betting team names
                                if (actualWinner === gameResult.home_team) {
                                    gameWinner = homeTeam;
                                } else {
                                    gameWinner = awayTeam;
                                }
                                
                                console.log(`🏆 ACTUAL GAME RESULT: ${actualScore} - Winner: ${gameWinner}`);
                            } else {
                                throw new Error('Game completed but scores not available');
                            }
                        } else {
                            throw new Error('Game not found in completed games or not yet completed');
                        }
                        
                    } catch (error) {
                        console.error('❌ Error fetching actual game results:', error.message);
                        console.log('⏭️  Skipping game resolution - cannot determine actual winner without API results');
                        // Skip this game if we can't get actual results
                        continue;
                    }
                    
                    // Split bets into winners and losers based on actual/determined winner
                    const winners = gameBets.filter(bet => bet.team === gameWinner);
                    const losers = gameBets.filter(bet => bet.team !== gameWinner);

                    const resultSource = actualScore ? `ACTUAL RESULT: ${actualScore}` : 'Simulated Result';
                    console.log(`🎯 Resolving ${winners.length} winners and ${losers.length} losers for ${gameInfo.game} (${resultSource} - Winner: ${gameWinner})`);

                    // Process winners
                    for (const bet of winners) {
                        const winnings = bet.odds > 0 ? (bet.amount * bet.odds / 100) : (bet.amount * 100 / Math.abs(bet.odds));
                        const finalAmount = roundToTwoDecimals(bet.amount + winnings);
                        const profitLoss = roundToTwoDecimals(winnings);

                        await new Promise((resolve, reject) => {
                            db.run('BEGIN TRANSACTION', (err) => {
                                if (err) reject(err);
                                else resolve();
                            });
                        });

                        try {
                            // Update user balance
                            await new Promise((resolve, reject) => {
                                db.run(
                                    "UPDATE users SET balance = ROUND(balance + ?, 2) WHERE id = ?",
                                    [finalAmount, bet.user_id],
                                    (err) => {
                                        if (err) reject(err);
                                        else resolve();
                                    }
                                );
                            });

                            // Mark bet as won
                            await new Promise((resolve, reject) => {
                                db.run(
                                    "UPDATE bets SET status = 'won', status_changed_at = datetime('now', 'utc'), final_amount = ?, profit_loss = ? WHERE id = ?",
                                    [finalAmount, profitLoss, bet.id],
                                    (err) => {
                                        if (err) reject(err);
                                        else resolve();
                                    }
                                );
                            });

                            await new Promise((resolve, reject) => {
                                db.run('COMMIT', (err) => {
                                    if (err) reject(err);
                                    else resolve();
                                });
                            });

                        } catch (error) {
                            await new Promise((resolve) => {
                                db.run('ROLLBACK', () => resolve());
                            });
                            console.error(`Error processing winning bet ${bet.id}:`, error);
                        }
                    }

                    // Process losers
                    for (const bet of losers) {
                        const finalAmount = 0;
                        const profitLoss = roundToTwoDecimals(-bet.amount);

                        await new Promise((resolve, reject) => {
                            db.run(
                                "UPDATE bets SET status = 'lost', status_changed_at = datetime('now', 'utc'), final_amount = ?, profit_loss = ? WHERE id = ?",
                                [finalAmount, profitLoss, bet.id],
                                (err) => {
                                    if (err) reject(err);
                                    else resolve();
                                }
                            );
                        });
                    }

                    resolvedGames++;
                    gameResults.push({
                        game: gameInfo.game,
                        totalBets: gameBets.length,
                        winners: winners.length,
                        losers: losers.length,
                        timeSinceGame: `${timeSinceGame.toFixed(1)}h ago`
                    });
                }
            }
        }

        console.log(`✅ Auto-resolved ${resolvedGames} completed games`);

        res.json({
            success: true,
            message: `Resolved ${resolvedGames} completed games`,
            resolvedGames,
            gameResults
        });

    } catch (error) {
        console.error('Error auto-resolving completed games:', error);
        res.status(500).json({ error: 'Failed to resolve completed games' });
    }
});

/**
 * Formats a UTC timestamp to user's local timezone
 * @param {string} utcTimestamp - UTC timestamp from database
 * @param {string} timezone - User's timezone (e.g., 'America/New_York')
 * @returns {Object} Formatted date information
 */
const formatTimestampForUser = (utcTimestamp, timezone = 'America/New_York') => {
    if (!utcTimestamp) return null;
    
    try {
        // Ensure the timestamp is treated as UTC
        let date;
        if (utcTimestamp.endsWith('Z') || utcTimestamp.includes('+')) {
            // Already has timezone info
            date = new Date(utcTimestamp);
        } else {
            // Assume it's UTC and add Z suffix
            date = new Date(utcTimestamp + 'Z');
        }
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.error('Invalid date:', utcTimestamp);
            return { utc: utcTimestamp, local: 'Invalid Date', date: 'Invalid Date', time: 'Invalid Time', timezone };
        }
        
        const options = {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        };
        
        const formatter = new Intl.DateTimeFormat('en-US', options);
        const parts = formatter.formatToParts(date);
        
        const formatted = parts.reduce((acc, part) => {
            acc[part.type] = part.value;
            return acc;
        }, {});
        
        return {
            utc: utcTimestamp,
            local: `${formatted.year}-${formatted.month}-${formatted.day} ${formatted.hour}:${formatted.minute}:${formatted.second}`,
            date: `${formatted.month}/${formatted.day}/${formatted.year}`,
            time: `${formatted.hour}:${formatted.minute}`, // Only hours and minutes for display
            timezone: timezone,
            fullTime: `${formatted.hour}:${formatted.minute}:${formatted.second}` // Full time with seconds if needed
        };
    } catch (error) {
        console.error('Error formatting timestamp:', error);
        return { utc: utcTimestamp, local: utcTimestamp, date: 'Invalid Date', time: 'Invalid Time', timezone };
    }
};

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Fantasy Sports Betting API ready');
});
