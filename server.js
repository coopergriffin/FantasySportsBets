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

// ============================================================================
// SPORT CONFIGURATION - Easy to modify for different game limits
// ============================================================================
/**
 * 🔧 TO INCREASE GAMES PER SPORT:
 * 1. Change `maxGamesPerSport` below (affects all sports)
 * 2. OR change individual sport `maxGames` values
 * 3. Restart server - changes take effect immediately
 * 
 * CURRENT LIMITS: Only 5 games per sport (saves API calls)
 * SUGGESTED INCREASES: 10-15 for testing, 20-30 for production
 * 
 * CACHE REFRESH: Currently every 60 minutes
 * - Increase for less API usage
 * - Decrease for more current data
 */
const SPORT_CONFIG = {
    maxGamesPerSport: 5,  // 🔧 CHANGE THIS to increase/decrease games per sport
    cacheRefreshMinutes: 60, // How often to refresh cache (in minutes)
    
    // Sport-specific settings
    sports: {
        'NFL': { 
            key: 'americanfootball_nfl', 
            display: 'NFL',
            maxGames: 5  // 🔧 Individual sport limits (optional override)
        },
        'NBA': { 
            key: 'basketball_nba', 
            display: 'NBA',
            maxGames: 5
        },
        'MLB': { 
            key: 'baseball_mlb', 
            display: 'MLB',
            maxGames: 5
        },
        'NHL': { 
            key: 'icehockey_nhl', 
            display: 'NHL',
            maxGames: 5
        }
    }
};

// Helper function to get max games for a sport
const getMaxGames = (sportKey) => {
    return SPORT_CONFIG.sports[sportKey]?.maxGames || SPORT_CONFIG.maxGamesPerSport;
};

// ============================================================================
// DATABASE AND CACHE SETUP
// ============================================================================

// Cache configuration
const CACHE_DURATION = SPORT_CONFIG.cacheRefreshMinutes * 60 * 1000; // Convert to milliseconds
let oddsCache = {
    data: {},  // Cache by sport
    lastFetched: {},  // Last fetch time by sport
    allSports: null,  // Cache for 'all' sports view
    allSportsLastFetched: null  // Last fetch time for 'all' sports
};

// Cache table setup
const db = new sqlite3.Database('./bets.db', (err) => {
    if (err) console.error('Error connecting to database:', err);
    else console.log('Connected to SQLite database.');
});

// Cache management functions
const isCacheValid = async (sport = 'all') => {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT last_fetched FROM odds_cache WHERE sport = ?',
            [sport],
            (err, row) => {
                if (err) {
                    console.error('Error checking cache validity:', err);
                    resolve(false);
                    return;
                }
                if (!row) {
                    resolve(false);
                    return;
                }
                const isValid = (Date.now() - row.last_fetched) < CACHE_DURATION;
                resolve(isValid);
            }
        );
    });
};

const getCachedData = async (sport = 'all') => {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT data FROM odds_cache WHERE sport = ?',
            [sport],
            (err, row) => {
                if (err) {
                    console.error('Error getting cached data:', err);
                    resolve(null);
                    return;
                }
                if (!row) {
                    resolve(null);
                    return;
                }
                try {
                    const games = JSON.parse(row.data);
                    resolve(games);
                } catch (e) {
                    console.error('Error parsing cached data:', e);
                    resolve(null);
                }
            }
        );
    });
};

const updateCache = async (games, sport = 'all') => {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(
            'INSERT OR REPLACE INTO odds_cache (sport, data, last_fetched) VALUES (?, ?, ?)'
        );
        
        stmt.run(
            sport,
            JSON.stringify(games),
            Date.now(),
            (err) => {
                if (err) {
                    console.error('Error updating cache:', err);
                    resolve(false);
                    return;
                }
                console.log(`Cache updated for ${sport} with ${games.length} games`);
                resolve(true);
            }
        );
        stmt.finalize();
    });
};

/**
 * Helper function to get mock odds data
 * @returns {Array} Array of mock games
 */
function getMockOdds() {
    return [
        {
            sport: 'NFL',
            home_team: "Kansas City Chiefs",
            away_team: "San Francisco 49ers",
            odds: -110,
            game_date: new Date(Date.now() + 86400000).toISOString()
        },
        {
            sport: 'NFL',
            home_team: "Green Bay Packers",
            away_team: "Chicago Bears",
            odds: +150,
            game_date: new Date(Date.now() + 86400000).toISOString()
        },
        {
            sport: 'NBA',
            home_team: "LA Lakers",
            away_team: "Golden State Warriors",
            odds: +150,
            game_date: new Date(Date.now() + 86400000).toISOString()
        },
        {
            sport: 'NBA',
            home_team: "Boston Celtics",
            away_team: "Miami Heat",
            odds: -120,
            game_date: new Date(Date.now() + 86400000).toISOString()
        },
        {
            sport: 'MLB',
            home_team: "New York Yankees",
            away_team: "Boston Red Sox",
            odds: -120,
            game_date: new Date(Date.now() + 86400000).toISOString()
        },
        {
            sport: 'MLB',
            home_team: "LA Dodgers",
            away_team: "San Francisco Giants",
            odds: +130,
            game_date: new Date(Date.now() + 86400000).toISOString()
        },
        {
            sport: 'NHL',
            home_team: "Toronto Maple Leafs",
            away_team: "Montreal Canadiens",
            odds: +130,
            game_date: new Date(Date.now() + 86400000).toISOString()
        },
        {
            sport: 'NHL',
            home_team: "New York Rangers",
            away_team: "Boston Bruins",
            odds: -115,
            game_date: new Date(Date.now() + 86400000).toISOString()
        }
    ];
}

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
        const maxGames = getMaxGames(sportKey);
        console.log(`Fetching odds for ${sportDisplay} (max ${maxGames} upcoming games)`);
        
        // Calculate date range - only get games for the next 2 weeks to stay focused
        const now = new Date();
        const maxDate = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)); // 2 weeks from now
        
        // Format dates properly for the API (remove milliseconds)
        const commenceTimeFrom = now.toISOString().split('.')[0] + 'Z';
        const commenceTimeTo = maxDate.toISOString().split('.')[0] + 'Z';
        
        // Use the fallback system to try multiple API keys
        const apiKeys = config.server.odds.apiKeys;
        console.log(`🔑 Trying ${apiKeys.length} available API keys for ${sportDisplay}`);
        
        let data = null;
        let lastError = null;
        
        for (let i = 0; i < apiKeys.length; i++) {
            const apiKey = apiKeys[i];
            if (!apiKey) continue;

            try {
                const url = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=american&commenceTimeFrom=${commenceTimeFrom}&commenceTimeTo=${commenceTimeTo}`;
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
        console.log(`Received ${data.length} upcoming games for ${sportDisplay} (next 2 weeks)`);

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
 * Get odds endpoint with simplified caching - limited games per sport
 * Only fetches and stores a small number of upcoming games per sport
 * @param {string} sport - Sport key to fetch odds for
 * @param {number} page - Page number to fetch
 * @param {number} limit - Number of items per page
 * @returns {Promise<Object>} Odds data
 */
app.get('/api/odds', authenticateToken, async (req, res) => {
    try {
        const { sport, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        // Check current cache status for the requested sport(s)
        const sportsToCheck = sport && sport !== 'all' ? [sport] : Object.keys(SPORT_CONFIG.sports);
        
        for (const sportKey of sportsToCheck) {
            if (!SPORT_CONFIG.sports[sportKey]) continue;
            
            const sportInfo = SPORT_CONFIG.sports[sportKey];
            const maxGames = getMaxGames(sportKey);
            
            // Check if we need fresh data for this sport
            const cacheStatus = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT COUNT(*) as count, MAX(created_at) as latest_update 
                     FROM odds_cache 
                     WHERE sport = ? AND datetime(commence_time) > datetime('now')`,
                    [sportInfo.display],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });

            // Determine if we need to fetch fresh data (simplified logic)
            const needsFresh = !cacheStatus.latest_update || 
                cacheStatus.count === 0 || 
                (Date.now() - new Date(cacheStatus.latest_update).getTime()) > CACHE_DURATION;

            if (needsFresh) {
                console.log(`🔄 Fetching fresh data for ${sportInfo.display} (${cacheStatus.count}/${maxGames} games in cache)`);
                await fetchOddsForSport(sportInfo.key, sportInfo.display);
            } else {
                const ageMinutes = Math.round((Date.now() - new Date(cacheStatus.latest_update).getTime()) / (1000 * 60));
                console.log(`✅ Using cached ${sportInfo.display} data (${cacheStatus.count}/${maxGames} games, ${ageMinutes}m old)`);
            }
        }

        // Get paginated results from cache
        let query = 'SELECT * FROM odds_cache';
        let countQuery = 'SELECT COUNT(*) as count FROM odds_cache';
        let params = [];
        let whereConditions = ['datetime(commence_time) > datetime(\'now\')'];

        if (sport && sport !== 'all') {
            whereConditions.push('sport = ?');
            params.push(sport);
        }

        if (whereConditions.length > 0) {
            query += ' WHERE ' + whereConditions.join(' AND ');
            countQuery += ' WHERE ' + whereConditions.join(' AND ');
        }

        // Sort by commence_time ascending (next games first) - this ensures chronological order across all sports
        query += ` ORDER BY datetime(commence_time) ASC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        // Get total count
        const countResult = await new Promise((resolve, reject) => {
            const countParams = sport && sport !== 'all' ? [sport] : [];
            db.get(countQuery, countParams, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // Get paginated results
        const results = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
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

        // Debug logging for game order
        if (formattedResults.length > 0) {
            console.log(`📅 Returning ${formattedResults.length} games for page ${page}:`);
            formattedResults.slice(0, 3).forEach((game, idx) => {
                const gameDate = new Date(game.commenceTime);
                const daysFromNow = Math.ceil((gameDate - new Date()) / (1000 * 60 * 60 * 24));
                console.log(`   ${idx + 1}. ${game.sport} - ${game.homeTeam} vs ${game.awayTeam} (${daysFromNow} days)`);
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
    console.log(`⚡ Limited to ${SPORT_CONFIG.maxGamesPerSport} games per sport for efficiency`);
    console.log(`🔄 Cache refreshes every ${SPORT_CONFIG.cacheRefreshMinutes} minutes`);

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
    for (const [sportKey, sportInfo] of Object.entries(SPORT_CONFIG.sports)) {
        const maxGames = getMaxGames(sportKey);
        await cleanupExcessGames(sportInfo.display, maxGames);
    }

    for (const [sportKey, sportInfo] of Object.entries(SPORT_CONFIG.sports)) {
        try {
            const maxGames = getMaxGames(sportKey);
            
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
                maxGames: getMaxGames(sportKey),
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
    console.log(`⚡ Limited to ${SPORT_CONFIG.maxGamesPerSport} games per sport to conserve API calls`);
    
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(sport, home_team, away_team, commence_time)
        )
    `);

    console.log('Connected to SQLite database.');
    console.log('Odds cache table ready');

    // Create test users if they don't exist
    const createTestUser = (username, password, email) => {
        const hashedPassword = bcrypt.hashSync(password, 10);
        db.run(
            "INSERT OR IGNORE INTO users (username, password, email) VALUES (?, ?, ?)",
            [username, hashedPassword, email],
            (err) => {
                if (err) {
                    console.error('Error creating test user:', err);
                } else {
                    console.log('Test user created:', username);
                }
            }
        );
    };

    // Create test users
    createTestUser('testuser', 'test123', 'test@example.com');
    createTestUser('johndoe', 'john123', 'john@example.com');
    createTestUser('janedoe', 'jane123', 'jane@example.com');

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
                balance: user.balance,
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
 * Returns current user's profile information
 */
app.get('/user', authenticateToken, (req, res) => {
    const userId = req.user.userId;
    
    db.get('SELECT id, username, email, balance, created_at FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            console.error('Database error fetching user:', err);
            return res.status(500).json({ error: 'Failed to fetch user data' });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
    });
});

/**
 * Place Bet Endpoint
 * Handles bet placement and balance updates
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

        // Place bet and update balance
        await db.run(
            'INSERT INTO bets (user_id, game, team, amount, odds, sport, game_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, game, team, amount, odds, sport, game_date]
        );

        await db.run(
            'UPDATE users SET balance = balance - ? WHERE id = ?',
            [amount, userId]
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
            newBalance: updatedUser.balance
        });
    } catch (error) {
        console.error('Error placing bet:', error);
        await db.run('ROLLBACK');
        res.status(500).json({ message: 'Error placing bet' });
    }
});

/**
 * Resolve Bet Endpoint
 * Updates bet outcomes and user balances
 */
app.post('/resolveBet', authenticateToken, [
    check('betId').isInt(),
    check('outcome').isIn(['won', 'lost'])
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { betId, outcome } = req.body;

    db.get(
        "SELECT * FROM bets WHERE id = ? AND status = 'pending'",
        [betId],
        (err, bet) => {
            if (err) {
                return res.status(500).json({ error: "Server error" });
            }
            if (!bet) {
                return res.status(404).json({ error: "Bet not found or already resolved" });
            }

            db.run("BEGIN TRANSACTION");

            try {
                // Update bet status
                db.run(
                    "UPDATE bets SET status = ? WHERE id = ?",
                    [outcome, betId]
                );

                // If bet is won, update user balance
                if (outcome === 'won') {
                    const winnings = Math.floor(bet.amount * (bet.odds > 0 ? (bet.odds / 100) : (-100 / bet.odds)));
                    db.run(
                        "UPDATE users SET balance = balance + ? WHERE id = ?",
                        [bet.amount + winnings, bet.user_id]
                    );
                }

                db.run("COMMIT");

                res.json({
                    success: true,
                    message: `Bet marked as ${outcome}`
                });
            } catch (error) {
                db.run("ROLLBACK");
                res.status(500).json({ error: "Failed to resolve bet" });
            }
        }
    );
});

/**
 * Get User Bets Endpoint
 * Retrieves betting history for a specific user
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

    db.all(
        "SELECT * FROM bets WHERE user_id = ? ORDER BY created_at DESC",
        [userId],
        (err, rows) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: "Failed to fetch betting history" });
            }
            console.log('Bets found:', rows ? rows.length : 0);
            
            // Ensure consistent status field (some might have 'outcome', some 'status')
            const processedBets = rows.map(bet => ({
                ...bet,
                status: bet.status || bet.outcome || 'pending'
            }));
            
            res.json(processedBets || []);
        }
    );
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

                // Find current odds for the same game and team
                let currentOdds = null;
                try {
                    const oddsResult = await new Promise((resolve, reject) => {
                        // Try to match by exact game name first
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
                            currentOdds = oddsData.find(odd => 
                                odd.name === bet.team || 
                                (bet.team && bet.team.includes(odd.name)) || 
                                (odd.name && odd.name.includes(bet.team))
                            );
                        }
                        
                        // Fallback: match by closest odds value
                        if (!currentOdds) {
                            currentOdds = oddsData.find(odd => Math.abs(odd.price - bet.odds) < 50) || oddsData[0];
                        }
                        
                        if (currentOdds) {
                            currentOdds = currentOdds.price;
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

                if (currentOdds !== null && currentOdds !== bet.odds) {
                    // Calculate the value change based on odds movement
                    // Better odds for bettor = higher payout potential = bet worth more
                    // Worse odds for bettor = lower payout potential = bet worth less
                    
                    const originalImpliedProb = bet.odds > 0 ? 100 / (bet.odds + 100) : Math.abs(bet.odds) / (Math.abs(bet.odds) + 100);
                    const currentImpliedProb = currentOdds > 0 ? 100 / (currentOdds + 100) : Math.abs(currentOdds) / (Math.abs(currentOdds) + 100);
                    
                    console.log(`Original implied probability: ${originalImpliedProb.toFixed(3)}`);
                    console.log(`Current implied probability: ${currentImpliedProb.toFixed(3)}`);
                    
                    // If current implied probability is LOWER, odds got BETTER (more favorable)
                    const probChange = originalImpliedProb - currentImpliedProb;
                    
                    // Calculate profit/loss based on how much the odds moved
                    // Amplify the change for noticeable effect but keep it reasonable
                    profitLoss = bet.amount * probChange * 3; 
                    
                    // Cap the profit/loss to reasonable bounds (max ±40% of bet amount)
                    profitLoss = Math.max(-bet.amount * 0.4, Math.min(bet.amount * 0.4, profitLoss));
                    sellValue = bet.amount + profitLoss;
                    
                    // Determine odds direction
                    if (bet.odds > 0 && currentOdds > 0) {
                        // Both positive: higher number = worse odds
                        oddsChange = currentOdds > bet.odds ? "Odds worsened (less favorable)" : "Odds improved (more favorable)";
                    } else if (bet.odds < 0 && currentOdds < 0) {
                        // Both negative: more negative = better odds
                        oddsChange = currentOdds < bet.odds ? "Odds improved (more favorable)" : "Odds worsened (less favorable)";
                    } else {
                        // Mixed signs
                        oddsChange = profitLoss > 0 ? "Odds improved" : "Odds worsened";
                    }
                    
                    console.log(`Calculated profit/loss: ${profitLoss.toFixed(2)}`);
                    console.log(`Sell value: ${sellValue.toFixed(2)}`);
                } else if (currentOdds === null) {
                    oddsChange = "Current odds unavailable - selling at original value";
                }

                // Round to 2 decimal places
                sellValue = Math.round(sellValue * 100) / 100;
                profitLoss = Math.round(profitLoss * 100) / 100;

                // Start a transaction to update user balance and update bet status
                db.run("BEGIN TRANSACTION");

                try {
                    // Update user's balance with sell value
                    await new Promise((resolve, reject) => {
                        db.run(
                            "UPDATE users SET balance = balance + ? WHERE id = ?",
                            [sellValue, userId],
                            (err) => {
                                if (err) reject(err);
                                resolve();
                            }
                        );
                    });

                    // Mark bet as sold (update status only)
                    await new Promise((resolve, reject) => {
                        db.run(
                            "UPDATE bets SET status = 'sold' WHERE id = ? AND user_id = ?",
                            [betId, userId],
                            (err) => {
                                if (err) reject(err);
                                resolve();
                            }
                        );
                    });

                    // Commit the transaction
                    db.run("COMMIT");
                    
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
                    db.run("ROLLBACK");
                    console.error('Transaction error:', error);
                    res.status(500).json({ error: "Failed to sell bet" });
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

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('\nTest user credentials:');
    console.log('Username: testuser');
    console.log('Password: test123');
});
