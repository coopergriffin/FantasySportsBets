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

/**
 * Sports Configuration Import
 * All sports settings centralized in sports-config.js for easy management
 */

/**
 * Cache Configuration
 * Centralized cache settings for consistent behavior
 */
const CACHE_REFRESH_MINUTES = 60;
const CACHE_DURATION = CACHE_REFRESH_MINUTES * 60 * 1000;

/**
 * Helper function to round monetary values to 2 decimal places
 * @param {number} amount - Amount to round
 * @returns {number} Rounded amount
 */
const roundToTwoDecimals = (amount) => {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
};

/**
 * Database Connection
 * SQLite for development, ready for PostgreSQL migration in production
 */
const db = new sqlite3.Database('./bets.db', (err) => {
    if (err) console.error('Error connecting to database:', err);
    else console.log('Connected to SQLite database.');
});



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
            const rawOdds = game.bookmakers?.[0]?.markets?.[0]?.outcomes || [];
            
            // Properly map odds to teams by name instead of relying on array order
            const homeTeamOdds = rawOdds.find(odd => odd.name === game.home_team);
            const awayTeamOdds = rawOdds.find(odd => odd.name === game.away_team);
            
            // Create properly ordered odds array with consistent team mapping
            const orderedOdds = [
                homeTeamOdds || { name: game.home_team, price: null },
                awayTeamOdds || { name: game.away_team, price: null }
            ];
            
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
                    JSON.stringify(orderedOdds)
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

        // Clean up excess games beyond configured limit
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
 * Automatically maintain game count for all sports
 * Checks every 30 minutes if any sport has fewer than required games
 */
const maintainGameCounts = async () => {
    console.log('\n🔄 AUTOMATIC GAME COUNT MAINTENANCE');
    console.log('=====================================');
    
    const supportedSports = getSupportedSports();
    let totalRefreshed = 0;
    
    for (const sport of supportedSports) {
        const sportKey = sport.value;
        const maxGames = getMaxGamesForSport(sportKey);
        
        try {
            // Check current game count for this sport
            const cacheStatus = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(*) as count FROM odds_cache 
                     WHERE sport = ? AND datetime(commence_time) > datetime('now')`,
                    [sport.label],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            const currentCount = cacheStatus.count || 0;
            
            if (currentCount < maxGames) {
                console.log(`🔄 ${sport.label}: ${currentCount}/${maxGames} games - fetching more`);
                await fetchOddsForSport(sportKey, sport.label);
                totalRefreshed++;
            } else {
                console.log(`✅ ${sport.label}: ${currentCount}/${maxGames} games - sufficient`);
            }
        } catch (error) {
            console.error(`❌ Error checking ${sport.label}:`, error.message);
        }
    }
    
    if (totalRefreshed > 0) {
        console.log(`🎯 Refreshed ${totalRefreshed} sports to maintain game counts`);
    } else {
        console.log(`🎯 All sports have sufficient games`);
    }
    console.log('=====================================\n');
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
        const isStale = !cacheStatus.latest_update || (Date.now() - new Date(cacheStatus.latest_update).getTime()) > CACHE_DURATION;
        const hasInsufficientGames = cacheStatus.count < maxGames;
        
        const needsFresh = isForceRefresh || 
            !cacheStatus.latest_update || 
            cacheStatus.count === 0 || 
            isStale ||
            hasInsufficientGames;

        if (needsFresh) {
            const refreshReason = isForceRefresh ? 'force refresh requested' : 
                cacheStatus.count === 0 ? 'no cache - lazy loading on user request' : 
                hasInsufficientGames ? `insufficient games (${cacheStatus.count}/${maxGames})` :
                'stale cache';
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
            const hasInsufficientGames = cachedCount < maxGames;

            let freshCount = 0;
            let status = '';

            if (cachedCount === 0) {
                status = '🔴 NO CACHE - Fetching upcoming games';
                freshCount = await fetchOddsForSport(sportInfo.key, sportInfo.display);
            } else if (hasInsufficientGames) {
                status = `🟡 INSUFFICIENT GAMES (${cachedCount}/${maxGames}) - Fetching more`;
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
            timezone TEXT DEFAULT 'America/Toronto'
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

    // Create historical game results table - PERMANENT STORAGE
    db.run(`
        CREATE TABLE IF NOT EXISTS game_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sport TEXT NOT NULL,
            game_date TEXT NOT NULL,
            home_team TEXT NOT NULL,
            away_team TEXT NOT NULL,
            home_score INTEGER,
            away_score INTEGER,
            winner TEXT,
            game_id TEXT,
            completed_at DATETIME DEFAULT (datetime('now', 'utc')),
            api_fetched_at DATETIME DEFAULT (datetime('now', 'utc')),
            UNIQUE(sport, home_team, away_team, game_date)
        )
    `);

    // Add new columns to existing users table if they don't exist
    db.run(`
        ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'America/Toronto'
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
    console.log('✅ Game results table ready - historical data will be stored permanently');
    console.log('Odds cache table ready');

    console.log('Database initialized successfully');

    // Only perform basic cleanup on startup - defer API calls until user requests data
    setTimeout(() => {
        console.log('\n🏈 LIGHTWEIGHT INITIALIZATION 🏈');
        console.log('=====================================');
        console.log('⚡ Deferring API calls until user requests data to conserve quota');
        
        // Only clean up old games, don't fetch new ones
        db.run("DELETE FROM odds_cache WHERE datetime(commence_time) <= datetime('now')", (err) => {
            if (err) {
                console.error('Error cleaning old games:', err);
            } else {
                console.log('✅ Cleaned up past games from cache');
                console.log('🔄 Fresh game data will be fetched when users request it');
            }
        });

        // 🏛️ Start the automated historical data collection system
        console.log('\n🤖 STARTING AUTOMATED HISTORICAL DATA COLLECTION');
        console.log('==================================================');
        
        // Initial collection after 30 seconds (let server fully start first)
        setTimeout(() => {
            console.log('🚀 Running initial historical data collection...');
            collectCompletedGamesForHistory().catch(err => 
                console.log('Initial collection error:', err.message)
            );
        }, 30000);

        // Schedule automatic collection every 6 hours
        setInterval(() => {
            console.log('\n⏰ SCHEDULED: Running automated historical data collection...');
            collectCompletedGamesForHistory().catch(err => 
                console.log('Scheduled collection error:', err.message)
            );
        }, 6 * 60 * 60 * 1000); // 6 hours = 6 * 60 * 60 * 1000 milliseconds

        console.log('✅ Automated collection scheduled every 6 hours');
        console.log('🏛️ Historical database will continuously grow to cover all past games');
        
    }, 1000); // Small delay to ensure database is fully ready
});

/**
 * Advertisement Configuration Endpoint
 * Returns ad configuration for frontend
 */
app.get('/api/ads/config', (req, res) => {
    try {
        const adConfig = {
            enabled: config.ads.enabled,
            developmentMode: config.ads.developmentMode,
            placements: config.ads.placements,
            fakeAds: config.ads.developmentMode ? config.ads.fakeAds : null
        };
        res.json(adConfig);
    } catch (error) {
        console.error('Error fetching ad config:', error);
        res.status(500).json({ error: 'Failed to fetch ad configuration' });
    }
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

    // List of valid timezones - one major city per unique timezone
    const validTimezones = [
        // Canadian Major Cities
        'America/St_Johns', 'America/Halifax', 'America/Toronto', 
        'America/Winnipeg', 'America/Edmonton', 'America/Vancouver',
        
        // US Major Cities
        'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles', 'America/Phoenix',
        'America/Denver', 'America/Chicago', 'America/New_York',
        
        // International Major Cities (UTC+12 to UTC-3)
        'Pacific/Auckland', 'Australia/Sydney', 'Asia/Tokyo', 'Asia/Shanghai',
        'Asia/Bangkok', 'Asia/Dhaka', 'Asia/Kolkata', 'Asia/Karachi', 'Asia/Dubai',
        'Europe/Moscow', 'Africa/Cairo', 'Europe/Paris', 'Europe/London',
        'UTC', 'Atlantic/Azores', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires'
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
 * Handles bet placement and balance updates with fresh odds verification and auto-updates
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
            return res.status(400).json({ 
                message: `Cannot place bet - game has already started` 
            });
        }

        // Store original odds and initialize variables
        const originalOdds = odds;
        let finalOdds = odds;
        let oddsUpdated = false;

        // 🔄 VERIFY CURRENT ODDS FOR BETTING OPERATION
        console.log(`🔍 Verifying current odds for bet placement...`);
        try {
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
                    
                    // If odds have changed at all, require user confirmation
                    if (oddsDifference > 0) {
                        console.log(`📊 Odds have changed: Original ${odds}, Current ${oddsVerified}, Difference: ${oddsDifference}`);
                        return res.status(400).json({ 
                            oddsChanged: true,
                            message: `Odds have changed from ${odds} to ${oddsVerified}. Do you want to continue with the updated odds?`,
                            originalOdds: odds,
                            currentOdds: oddsVerified,
                            difference: oddsDifference
                        });
                    } else {
                        console.log(`✅ Odds verification passed - no change detected`);
                    }
                } else {
                    console.log(`⚠️ Could not find odds for team ${team}, proceeding with original odds`);
                }
            } else {
                console.log(`⚠️ Could not verify current odds, proceeding with original odds`);
            }
        } catch (oddsError) {
            console.log(`⚠️ Error verifying odds: ${oddsError.message}, proceeding with original odds`);
        }

        // Start a database transaction
        await db.run('BEGIN TRANSACTION');

        try {
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

            // Place bet and update balance using final odds
            // Store proper UTC timestamp that preserves timezone info
            const utcTimestamp = new Date().toISOString();
            await db.run(
                'INSERT INTO bets (user_id, game, team, amount, odds, sport, game_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [userId, game, team, roundedAmount, finalOdds, sport, game_date, utcTimestamp]
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

            // Send success response
            res.json({
                success: true,
                message: oddsUpdated ? 
                    `Bet placed successfully with updated odds (${finalOdds})` : 
                    'Bet placed successfully',
                newBalance: roundToTwoDecimals(updatedUser.balance),
                oddsUpdated: oddsUpdated,
                finalOdds: finalOdds,
                originalOdds: originalOdds
            });

        } catch (dbError) {
            await db.run('ROLLBACK');
            throw dbError;
        }

    } catch (error) {
        console.error('Error placing bet:', error);
        try {
            await db.run('ROLLBACK');
        } catch (rollbackError) {
            console.error('Error rolling back transaction:', rollbackError);
        }
        res.status(500).json({ message: 'Error placing bet' });
    }
});

/**
 * Place Bet with Confirmed Odds Endpoint
 * Used when user confirms they want to proceed with updated odds
 */
app.post('/api/bets/confirm-odds', authenticateToken, async (req, res) => {
    const { game, team, amount, confirmedOdds, sport, game_date } = req.body;
    const userId = req.user.userId;

    try {
        console.log('Placing bet with confirmed odds:', {
            userId,
            game,
            team,
            amount,
            confirmedOdds,
            sport,
            game_date
        });

        // Check if betting is still allowed for this sport and game time
        if (!isBettingAllowed(game_date, sport)) {
            return res.status(400).json({ 
                message: `Cannot place bet - game has already started` 
            });
        }

        // 🔄 DOUBLE-CHECK ODDS HAVEN'T CHANGED AGAIN
        console.log(`🔍 Double-checking odds for final verification...`);
        let finalOdds = confirmedOdds;
        
        try {
            const currentOddsData = await verifyOddsForBetting(sport, game);
            
            if (currentOddsData && currentOddsData.length > 0) {
                const teamOdds = currentOddsData.find(odd => 
                    odd.name === team || 
                    (team && team.includes(odd.name)) || 
                    (odd.name && odd.name.includes(team))
                );
                
                if (teamOdds) {
                    const currentOdds = teamOdds.price;
                    const oddsDifference = Math.abs(confirmedOdds - currentOdds);
                    
                    console.log(`🔍 Final odds check: Confirmed ${confirmedOdds}, Current ${currentOdds}, Difference: ${oddsDifference}`);
                    
                    // If odds changed again, reject and ask user to restart
                    if (oddsDifference > 0) {
                        console.log(`❌ Odds changed again during confirmation! Confirmed: ${confirmedOdds}, Current: ${currentOdds}`);
                        return res.status(400).json({ 
                            message: `Odds have changed again! Please restart your bet with the latest odds (${currentOdds}).`,
                            confirmedOdds: confirmedOdds,
                            currentOdds: currentOdds,
                            oddsChangedAgain: true
                        });
                    }
                    
                    finalOdds = currentOdds; // Use the verified current odds
                    console.log(`✅ Final odds verification passed`);
                }
            }
        } catch (oddsError) {
            console.log(`⚠️ Error in final odds verification: ${oddsError.message}, proceeding with confirmed odds`);
        }

        // Start a database transaction
        await db.run('BEGIN TRANSACTION');

        try {
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

            // Place bet and update balance using final verified odds
            const utcTimestamp = new Date().toISOString();
            
            await db.run(
                'INSERT INTO bets (user_id, game, team, amount, odds, sport, game_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [userId, game, team, roundedAmount, finalOdds, sport, game_date, utcTimestamp]
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

            // Send success response
            res.json({
                success: true,
                message: 'Bet placed successfully with confirmed odds',
                newBalance: roundToTwoDecimals(updatedUser.balance),
                finalOdds: finalOdds
            });

        } catch (dbError) {
            await db.run('ROLLBACK');
            throw dbError;
        }

    } catch (error) {
        console.error('Error placing bet with confirmed odds:', error);
        try {
            await db.run('ROLLBACK');
        } catch (rollbackError) {
            console.error('Error rolling back transaction:', rollbackError);
        }
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

        const userTimezone = userInfo?.timezone || 'America/Toronto';

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
                
                // Return raw UTC timestamps - let frontend handle all timezone conversion
                const processedBets = rows.map(bet => {
                    return {
                        ...bet,
                        status: bet.status || bet.outcome || 'pending'
                        // All timestamps (created_at, status_changed_at, game_date) are returned as raw UTC
                        // Frontend will handle timezone conversion for display
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
            return res.status(400).json({ 
                error: `Cannot sell bet - game has already started` 
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
 * REVOLUTIONARY HYBRID Auto-resolve completed games endpoint
 * 1. Check historical database FIRST (instant resolution for old games)
 * 2. Fall back to API for recent games
 * 3. Store any API results permanently for future use
 */
app.post('/api/resolve-completed-games', authenticateToken, async (req, res) => {
    try {
        console.log('🎯 Starting HYBRID bet resolution (Historical DB + API)...');
        
        // Get ALL pending bets - no time restrictions
        const allPendingBets = await new Promise((resolve, reject) => {
            db.all(`
                SELECT id, user_id, game, team, amount, odds, sport, game_date
                FROM bets 
                WHERE status = 'pending'
                ORDER BY game_date DESC
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        console.log(`📊 Found ${allPendingBets.length} pending bets to resolve`);
        
        if (allPendingBets.length === 0) {
            return res.json({
                success: true,
                message: '✅ No pending bets to resolve',
                resolvedGames: 0
            });
        }

        let totalResolvedGames = 0;
        let historicalResolutions = 0;
        let apiResolutions = 0;
        const gameResults = [];

        // STEP 1: Try to resolve each bet using HISTORICAL DATABASE first
        console.log('\n🏛️ STEP 1: Checking Historical Database...');
        const unresolvedBets = [];

        for (const bet of allPendingBets) {
            console.log(`🔍 Checking historical data for: ${bet.game}`);
            
            const historicalResult = await resolveBetFromHistoricalData(bet);
            
            if (historicalResult && historicalResult.found) {
                console.log(`🏛️ RESOLVED FROM HISTORICAL DATA! ${bet.game}`);
                
                // Resolve the bet using historical data
                if (historicalResult.betWon) {
                    const winnings = calculateWinnings(bet.amount, bet.odds);
                    
                    // Update bet status and user balance
                    await new Promise((resolve, reject) => {
                        db.run(
                            'UPDATE bets SET status = ?, status_changed_at = datetime(\'now\', \'utc\'), final_amount = ?, profit_loss = ? WHERE id = ?',
                            ['won', winnings.totalPayout, winnings.winnings, bet.id],
                            (err) => err ? reject(err) : resolve()
                        );
                    });

                    await new Promise((resolve, reject) => {
                        db.run(
                            'UPDATE users SET balance = ROUND(balance + ?, 2) WHERE id = ?',
                            [winnings.totalPayout, bet.user_id],
                            (err) => err ? reject(err) : resolve()
                        );
                    });
                } else {
                    // Bet lost
                    await new Promise((resolve, reject) => {
                        db.run(
                            'UPDATE bets SET status = ?, status_changed_at = datetime(\'now\', \'utc\'), final_amount = ?, profit_loss = ? WHERE id = ?',
                            ['lost', 0, -bet.amount, bet.id],
                            (err) => err ? reject(err) : resolve()
                        );
                    });
                }
                
                totalResolvedGames++;
                historicalResolutions++;
                
                // Find or create game result entry
                let existingGameResult = gameResults.find(gr => gr.game === bet.game);
                if (!existingGameResult) {
                    existingGameResult = { game: bet.game, winners: 0, losers: 0 };
                    gameResults.push(existingGameResult);
                }
                
                if (historicalResult.betWon) {
                    existingGameResult.winners++;
                } else {
                    existingGameResult.losers++;
                }
                
            } else {
                console.log(`📝 No historical data found for: ${bet.game} - will check API`);
                unresolvedBets.push(bet);
            }
        }

        console.log(`🏛️ Historical DB Results: ${historicalResolutions} bets resolved`);

        // STEP 2: For remaining bets, use API (with automatic storage for future use)
        if (unresolvedBets.length > 0) {
            console.log(`\n📡 STEP 2: Checking API for ${unresolvedBets.length} remaining bets...`);
            
            // Group by unique games to minimize API calls
            const uniqueGames = {};
            unresolvedBets.forEach(bet => {
                const gameKey = `${bet.sport}:${bet.game}:${bet.game_date}`;
                if (!uniqueGames[gameKey]) {
                    uniqueGames[gameKey] = {
                        sport: bet.sport,
                        game: bet.game,
                        game_date: bet.game_date,
                        bets: []
                    };
                }
                uniqueGames[gameKey].bets.push(bet);
            });

            const apiKeys = config.server.odds.apiKeys;

            for (const [gameKey, gameData] of Object.entries(uniqueGames)) {
                console.log(`\n🔍 API check: ${gameData.game} (${gameData.sport})`);
                
                try {
                    const gameMatch = gameData.game.match(/^(.+)\s+vs\s+(.+)$/);
                    if (!gameMatch) continue;

                    const [, team1, team2] = gameMatch;
                    const sportKey = getApiSportKey(gameData.sport);
                    if (!sportKey) continue;

                    // Try API keys until we get data
                    let completedGame = null;
                    for (let i = 0; i < apiKeys.length; i++) {
                        const apiKey = apiKeys[i];
                        if (!apiKey) continue;

                        try {
                            const scoresUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/scores/?apiKey=${apiKey}&daysFrom=30`;
                            const response = await fetch(scoresUrl);
                            
                            if (response.ok) {
                                const scoresData = await response.json();
                                
                                completedGame = scoresData.find(game => {
                                    const isMatch = (
                                        (game.home_team.includes(team1) || team1.includes(game.home_team)) &&
                                        (game.away_team.includes(team2) || team2.includes(game.away_team))
                                    ) || (
                                        (game.home_team.includes(team2) || team2.includes(game.home_team)) &&
                                        (game.away_team.includes(team1) || team1.includes(game.away_team))
                                    );
                                    return isMatch && game.completed;
                                });
                                
                                break; // Success with this API key
                            }
                        } catch (error) {
                            console.log(`❌ API key ${i + 1} failed:`, error.message);
                        }
                    }

                    if (!completedGame) {
                        console.log(`⏳ Game not completed yet in API: ${gameData.game}`);
                        continue;
                    }

                    console.log(`🏆 COMPLETED GAME FOUND IN API! ${completedGame.home_team} vs ${completedGame.away_team}`);

                    const homeScore = completedGame.scores?.find(s => s.name === completedGame.home_team)?.score;
                    const awayScore = completedGame.scores?.find(s => s.name === completedGame.away_team)?.score;

                    if (homeScore === undefined || awayScore === undefined) continue;

                    const winner = homeScore > awayScore ? completedGame.home_team : completedGame.away_team;

                    // 🏛️ STORE RESULT PERMANENTLY for future use
                    const gameResultForStorage = {
                        sport: gameData.sport,
                        game_date: gameData.game_date,
                        home_team: completedGame.home_team,
                        away_team: completedGame.away_team,
                        home_score: homeScore,
                        away_score: awayScore,
                        winner: winner,
                        game_id: completedGame.id
                    };
                    
                    await storeGameResultPermanently(gameResultForStorage);
                    console.log(`🏛️ Result stored for future use!`);

                    let winners = 0;
                    let losers = 0;

                    // Resolve all bets for this game
                    for (const bet of gameData.bets) {
                        const betWon = winner.includes(bet.team) || bet.team.includes(winner);

                        if (betWon) {
                            const winnings = calculateWinnings(bet.amount, bet.odds);
                            
                            await new Promise((resolve, reject) => {
                                db.run(
                                    'UPDATE bets SET status = ?, status_changed_at = datetime(\'now\', \'utc\'), final_amount = ?, profit_loss = ? WHERE id = ?',
                                    ['won', winnings.totalPayout, winnings.winnings, bet.id],
                                    (err) => err ? reject(err) : resolve()
                                );
                            });

                            await new Promise((resolve, reject) => {
                                db.run(
                                    'UPDATE users SET balance = ROUND(balance + ?, 2) WHERE id = ?',
                                    [winnings.totalPayout, bet.user_id],
                                    (err) => err ? reject(err) : resolve()
                                );
                            });

                            winners++;
                        } else {
                            await new Promise((resolve, reject) => {
                                db.run(
                                    'UPDATE bets SET status = ?, status_changed_at = datetime(\'now\', \'utc\'), final_amount = ?, profit_loss = ? WHERE id = ?',
                                    ['lost', 0, -bet.amount, bet.id],
                                    (err) => err ? reject(err) : resolve()
                                );
                            });

                            losers++;
                        }
                    }

                    gameResults.push({
                        game: gameData.game,
                        winners,
                        losers
                    });

                    totalResolvedGames++;
                    apiResolutions++;

                } catch (error) {
                    console.error(`❌ Error processing ${gameData.game}:`, error);
                }
            }
        }

        // STEP 3: Trigger background collection for future improvements
        console.log('\n🔄 STEP 3: Triggering background historical data collection...');
        setTimeout(() => {
            collectCompletedGamesForHistory().catch(err => 
                console.log('Background collection error:', err.message)
            );
        }, 1000); // Run in background after response

        const message = totalResolvedGames > 0 
            ? `🎯 HYBRID resolution complete! ${totalResolvedGames} games resolved (${historicalResolutions} from database, ${apiResolutions} from API)`
            : '⏳ No completed games found for pending bets';

        res.json({
            success: true,
            message,
            resolvedGames: totalResolvedGames,
            historicalResolutions,
            apiResolutions,
            gameResults,
            debugInfo: {
                totalPendingBets: allPendingBets.length,
                resolvedFromDatabase: historicalResolutions,
                resolvedFromAPI: apiResolutions
            }
        });

    } catch (error) {
        console.error('❌ Error in hybrid game resolution:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to resolve completed games',
            details: error.message
        });
    }
});

// Helper function to calculate winnings (if not already defined)
function calculateWinnings(betAmount, odds) {
    let winnings;
    if (odds > 0) {
        // Positive odds (e.g., +150 means win $150 on $100 bet)
        winnings = (betAmount * odds) / 100;
    } else {
        // Negative odds (e.g., -150 means bet $150 to win $100)
        winnings = (betAmount * 100) / Math.abs(odds);
    }
    
    return {
        winnings: Math.round(winnings * 100) / 100,
        totalPayout: Math.round((betAmount + winnings) * 100) / 100
    };
}

/**
 * Clear all betting data - for testing purposes
 */
app.post('/api/clear-betting-data', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    
    // Only allow this in development
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Not allowed in production' });
    }
    
    console.log('🗑️ Clearing all betting data for testing...');
    
    // Clear all bets
    db.run('DELETE FROM bets', (err) => {
        if (err) {
            console.error('Error clearing bets:', err);
            return res.status(500).json({ error: 'Failed to clear bets' });
        }
        
        // Reset user balance to $1000
        db.run('UPDATE users SET balance = 1000.00', (err) => {
            if (err) {
                console.error('Error resetting balance:', err);
                return res.status(500).json({ error: 'Failed to reset balance' });
            }
            
            console.log('✅ Cleared all bets and reset balance to $1000');
            res.json({ 
                success: true, 
                message: 'All betting data cleared and balance reset to $1000' 
            });
        });
    });
});

// Server-side timestamp formatting removed - all timezone conversion now handled in frontend
// Backend only works with UTC timestamps for all logic and storage

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Fantasy Sports Betting API ready');
    
    // Set up automatic game count maintenance every 30 minutes
    setInterval(maintainGameCounts, 30 * 60 * 1000); // 30 minutes
    console.log('🔄 Automatic game count maintenance scheduled every 30 minutes');
});

/**
 * HISTORICAL GAME RESULTS SYSTEM
 * Permanent storage solution that eliminates the 3-day API limitation
 */

/**
 * Stores a completed game result permanently in the database
 * @param {Object} gameResult - Game result data
 * @returns {Promise<boolean>} Success status
 */
const storeGameResultPermanently = async (gameResult) => {
    try {
        const { sport, game_date, home_team, away_team, home_score, away_score, winner, game_id } = gameResult;
        
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT OR REPLACE INTO game_results 
                 (sport, game_date, home_team, away_team, home_score, away_score, winner, game_id, completed_at, api_fetched_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'utc'), datetime('now', 'utc'))`,
                [sport, game_date, home_team, away_team, home_score, away_score, winner, game_id],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        console.log(`✅ Stored historical result: ${home_team} ${home_score}-${away_score} ${away_team} (${sport})`);
        return true;
    } catch (error) {
        console.error('❌ Error storing game result:', error);
        return false;
    }
};

/**
 * Collects and stores completed games from the API for permanent historical storage
 * This function runs automatically to build up our historical database
 * @returns {Promise<number>} Number of games collected
 */
const collectCompletedGamesForHistory = async () => {
    console.log('\n🏛️ COLLECTING COMPLETED GAMES FOR HISTORICAL STORAGE');
    console.log('=======================================================');
    
    let totalCollected = 0;
    const supportedSports = getSupportedSports();
    const apiKeys = config.server.odds.apiKeys;
    
    for (const sport of supportedSports) {
        try {
            const sportKey = getApiSportKey(sport.value);
            if (!sportKey) continue;
            
            console.log(`📊 Collecting ${sport.label} completed games...`);
            
            // Try each API key until we get data
            let completedGames = null;
            for (let i = 0; i < apiKeys.length; i++) {
                const apiKey = apiKeys[i];
                if (!apiKey) continue;

                try {
                    const scoresUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/scores/?apiKey=${apiKey}&daysFrom=3`;
                    
                    const response = await fetch(scoresUrl);
                    if (response.ok) {
                        completedGames = await response.json();
                        console.log(`✅ Retrieved ${completedGames.length} completed ${sport.label} games from API`);
                        break;
                    } else {
                        console.log(`❌ API key ${i + 1} failed for ${sport.label}: ${response.status}`);
                    }
                } catch (error) {
                    console.log(`❌ API key ${i + 1} error for ${sport.label}:`, error.message);
                }
            }
            
            if (!completedGames) {
                console.log(`⚠️ Could not fetch completed games for ${sport.label}`);
                continue;
            }
            
            // Store each completed game
            let sportCollected = 0;
            for (const game of completedGames) {
                if (!game.completed || !game.scores) continue;
                
                const homeScore = game.scores.find(s => s.name === game.home_team)?.score;
                const awayScore = game.scores.find(s => s.name === game.away_team)?.score;
                
                if (homeScore === undefined || awayScore === undefined) continue;
                
                const winner = homeScore > awayScore ? game.home_team : game.away_team;
                
                const gameResult = {
                    sport: sport.label,
                    game_date: game.commence_time,
                    home_team: game.home_team,
                    away_team: game.away_team,
                    home_score: homeScore,
                    away_score: awayScore,
                    winner: winner,
                    game_id: game.id
                };
                
                const stored = await storeGameResultPermanently(gameResult);
                if (stored) sportCollected++;
            }
            
            console.log(`📈 ${sport.label}: ${sportCollected} games added to historical database`);
            totalCollected += sportCollected;
            
        } catch (error) {
            console.error(`❌ Error collecting ${sport.label} games:`, error);
        }
    }
    
    console.log(`\n📊 COLLECTION COMPLETE: ${totalCollected} historical games stored`);
    console.log('=======================================================\n');
    
    return totalCollected;
};

/**
 * Resolves a bet using historical game results from our permanent database
 * @param {Object} bet - The bet to resolve
 * @returns {Promise<Object|null>} Resolution result or null if not found
 */
const resolveBetFromHistoricalData = async (bet) => {
    try {
        // Parse team names from game string
        const gameMatch = bet.game.match(/^(.+)\s+vs\s+(.+)$/);
        if (!gameMatch) return null;
        
        const [, team1, team2] = gameMatch;
        
        // Check our historical database first
        const historicalResult = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM game_results 
                 WHERE sport = ? AND game_date = ?
                 AND ((home_team LIKE ? OR home_team LIKE ?) 
                      AND (away_team LIKE ? OR away_team LIKE ?))`,
                [bet.sport, bet.game_date, `%${team1}%`, `%${team2}%`, `%${team1}%`, `%${team2}%`],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
        
        if (historicalResult) {
            console.log(`🏛️ Found historical result: ${historicalResult.home_team} ${historicalResult.home_score}-${historicalResult.away_score} ${historicalResult.away_team}`);
            
            // Determine if bet won
            const betWon = historicalResult.winner.includes(bet.team) || bet.team.includes(historicalResult.winner);
            
            return {
                found: true,
                betWon: betWon,
                winner: historicalResult.winner,
                homeScore: historicalResult.home_score,
                awayScore: historicalResult.away_score,
                source: 'historical_database'
            };
        }
        
        return null;
    } catch (error) {
        console.error('❌ Error checking historical data:', error);
        return null;
    }
};

/**
 * HISTORICAL DATA MANAGEMENT ENDPOINTS
 * Admin tools for managing the permanent game results database
 */

/**
 * Manually trigger historical data collection (admin endpoint)
 */
app.post('/api/admin/collect-historical-data', authenticateToken, async (req, res) => {
    try {
        console.log('🔧 MANUAL HISTORICAL DATA COLLECTION TRIGGERED');
        console.log('===============================================');
        
        const collectedCount = await collectCompletedGamesForHistory();
        
        res.json({
            success: true,
            message: `✅ Manual collection complete! ${collectedCount} historical games collected and stored`,
            gamesCollected: collectedCount,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error in manual historical data collection:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to collect historical data',
            details: error.message
        });
    }
});

/**
 * Check historical database status (admin endpoint)
 */
app.get('/api/admin/historical-data-status', authenticateToken, async (req, res) => {
    try {
        // Get count of stored historical games by sport
        const sportCounts = await new Promise((resolve, reject) => {
            db.all(`
                SELECT sport, 
                       COUNT(*) as game_count,
                       MIN(DATE(game_date)) as earliest_game,
                       MAX(DATE(game_date)) as latest_game
                FROM game_results 
                GROUP BY sport
                ORDER BY sport
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Get total count
        const totalCount = await new Promise((resolve, reject) => {
            db.get(`
                SELECT COUNT(*) as total_games
                FROM game_results
            `, [], (err, row) => {
                if (err) reject(err);
                else resolve(row.total_games);
            });
        });

        // Get recent additions
        const recentGames = await new Promise((resolve, reject) => {
            db.all(`
                SELECT sport, home_team, away_team, home_score, away_score, winner, 
                       DATE(game_date) as game_date, DATE(completed_at) as stored_date
                FROM game_results 
                ORDER BY completed_at DESC 
                LIMIT 10
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json({
            success: true,
            totalStoredGames: totalCount,
            sportBreakdown: sportCounts,
            recentlyStored: recentGames,
            systemStatus: 'active',
            lastChecked: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error checking historical data status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get historical data status',
            details: error.message
        });
    }
});

/**
 * Manually resolve old stuck bets using historical data (admin endpoint)
 */
app.post('/api/admin/resolve-stuck-bets', authenticateToken, async (req, res) => {
    try {
        console.log('🔧 MANUAL STUCK BETS RESOLUTION');
        console.log('=================================');
        
        // Get all pending bets older than 7 days
        const oldPendingBets = await new Promise((resolve, reject) => {
            db.all(`
                SELECT id, user_id, game, team, amount, odds, sport, game_date,
                       DATE(game_date) as game_date_only
                FROM bets 
                WHERE status = 'pending' 
                AND DATE(game_date) <= DATE('now', '-7 days')
                ORDER BY game_date ASC
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        console.log(`📊 Found ${oldPendingBets.length} stuck bets older than 7 days`);

        if (oldPendingBets.length === 0) {
            return res.json({
                success: true,
                message: '✅ No stuck bets found!',
                resolvedBets: 0
            });
        }

        let resolvedCount = 0;
        const resolvedDetails = [];

        for (const bet of oldPendingBets) {
            console.log(`🔍 Checking stuck bet: ${bet.game} (${bet.game_date_only})`);
            
            const historicalResult = await resolveBetFromHistoricalData(bet);
            
            if (historicalResult && historicalResult.found) {
                console.log(`🏛️ RESOLVING STUCK BET: ${bet.game}`);
                
                if (historicalResult.betWon) {
                    const winnings = calculateWinnings(bet.amount, bet.odds);
                    
                    await new Promise((resolve, reject) => {
                        db.run(
                            'UPDATE bets SET status = ?, status_changed_at = datetime(\'now\', \'utc\'), final_amount = ?, profit_loss = ? WHERE id = ?',
                            ['won', winnings.totalPayout, winnings.winnings, bet.id],
                            (err) => err ? reject(err) : resolve()
                        );
                    });

                    await new Promise((resolve, reject) => {
                        db.run(
                            'UPDATE users SET balance = ROUND(balance + ?, 2) WHERE id = ?',
                            [winnings.totalPayout, bet.user_id],
                            (err) => err ? reject(err) : resolve()
                        );
                    });

                    resolvedDetails.push({
                        game: bet.game,
                        team: bet.team,
                        amount: bet.amount,
                        result: 'WON',
                        payout: winnings.totalPayout
                    });
                } else {
                    await new Promise((resolve, reject) => {
                        db.run(
                            'UPDATE bets SET status = ?, status_changed_at = datetime(\'now\', \'utc\'), final_amount = ?, profit_loss = ? WHERE id = ?',
                            ['lost', 0, -bet.amount, bet.id],
                            (err) => err ? reject(err) : resolve()
                        );
                    });

                    resolvedDetails.push({
                        game: bet.game,
                        team: bet.team,
                        amount: bet.amount,
                        result: 'LOST',
                        payout: 0
                    });
                }
                
                resolvedCount++;
            } else {
                console.log(`❓ No historical data available for: ${bet.game}`);
            }
        }

        res.json({
            success: true,
            message: `🎯 Stuck bet resolution complete! ${resolvedCount} of ${oldPendingBets.length} bets resolved using historical data`,
            totalStuckBets: oldPendingBets.length,
            resolvedBets: resolvedCount,
            resolvedDetails: resolvedDetails,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error resolving stuck bets:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to resolve stuck bets',
            details: error.message
        });
    }
});
