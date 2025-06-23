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

// Cache configuration
const CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
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
console.log('Config API Key configured:', !!config.server.odds.apiKey);

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

// Function to fetch odds for a specific sport
const fetchOddsForSport = async (sportKey, sportDisplay) => {
    try {
        console.log(`Fetching odds for ${sportDisplay}`);
        const response = await fetch(
            `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${process.env.ODDS_API_KEY}&regions=us&markets=h2h&oddsFormat=american`
        );
        
        if (!response.ok) {
            throw new Error(`Failed to fetch ${sportDisplay} odds: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`Received ${data.length} games for ${sportDisplay}`);

        // Insert each game into the database
        for (const game of data) {
            const odds = game.bookmakers?.[0]?.markets?.[0]?.outcomes || [];
            await db.run(
                `INSERT OR REPLACE INTO odds_cache (sport, game, home_team, away_team, commence_time, odds) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    sportDisplay,
                    `${game.home_team} vs ${game.away_team}`,
                    game.home_team,
                    game.away_team,
                    game.commence_time,
                    JSON.stringify(odds)
                ]
            );
        }

        return data.length;
    } catch (error) {
        console.error(`Error fetching ${sportDisplay} odds:`, error);
        return 0;
    }
};

/**
 * Get odds endpoint with efficient caching and pagination
 * @param {string} sport - Sport key to fetch odds for
 * @param {number} page - Page number to fetch
 * @param {number} limit - Number of items per page
 * @returns {Promise<Object>} Odds data
 */
app.get('/api/odds', authenticateToken, async (req, res) => {
    try {
        const { sport, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        // Check if we need to fetch fresh odds
        const checkStaleData = await new Promise((resolve, reject) => {
            const query = sport 
                ? 'SELECT COUNT(*) as count, MAX(created_at) as latest_update FROM odds_cache WHERE sport = ?' 
                : 'SELECT COUNT(*) as count, MAX(created_at) as latest_update FROM odds_cache';
            const params = sport ? [sport] : [];
            
            db.get(query, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // If no data or data is older than 1 hour, fetch new data
        const isStale = !checkStaleData.latest_update || 
            (Date.now() - new Date(checkStaleData.latest_update).getTime()) > 3600000;

        if (checkStaleData.count === 0 || isStale) {
            if (sport) {
                // Fetch only the requested sport
                const sportMap = {
                    'NFL': { key: 'americanfootball_nfl', display: 'NFL' },
                    'NBA': { key: 'basketball_nba', display: 'NBA' },
                    'MLB': { key: 'baseball_mlb', display: 'MLB' },
                    'NHL': { key: 'icehockey_nhl', display: 'NHL' }
                };

                if (sportMap[sport]) {
                    await fetchOddsForSport(sportMap[sport].key, sport);
                }
            } else {
                // If no specific sport is requested, update all sports
                const sportsToFetch = [
                    { key: 'americanfootball_nfl', display: 'NFL' },
                    { key: 'basketball_nba', display: 'NBA' },
                    { key: 'baseball_mlb', display: 'MLB' },
                    { key: 'icehockey_nhl', display: 'NHL' }
                ];

                for (const sportInfo of sportsToFetch) {
                    await fetchOddsForSport(sportInfo.key, sportInfo.display);
                }
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

        // Always sort by commence_time, but handle null/invalid dates
        query += ` ORDER BY 
                    CASE 
                        WHEN datetime(commence_time) IS NULL THEN 1 
                        ELSE 0 
                    END,
                    datetime(commence_time) ASC 
                  LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        // Get total count
        const countResult = await new Promise((resolve, reject) => {
            db.get(countQuery, sport && sport !== 'all' ? [sport] : [], (err, row) => {
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

        res.json({
            total: countResult.count,
            page: parseInt(page),
            totalPages: Math.ceil(countResult.count / limit),
            data: formattedResults
        });
    } catch (error) {
        console.error('Error fetching odds:', error);
        res.status(500).json({ message: 'Error fetching odds data' });
    }
});

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
            amount REAL,
            odds INTEGER,
            sport TEXT,
            status TEXT DEFAULT 'pending',
            game_date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Create odds cache table if it doesn't exist
    db.run(`
        CREATE TABLE IF NOT EXISTS odds_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sport TEXT,
            game TEXT,
            home_team TEXT,
            away_team TEXT,
            commence_time TEXT,
            odds TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

    // Fetch initial odds data
    fetchOddsForSport('americanfootball_nfl', 'NFL');
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
 * Place Bet Endpoint
 * Handles bet placement and balance updates
 */
app.post('/api/bets', authenticateToken, async (req, res) => {
    const { game, amount, odds, sport, game_date } = req.body;
    const userId = req.user.userId;

    try {
        console.log('Attempting to place bet:', {
            userId,
            game,
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
            'INSERT INTO bets (user_id, game, amount, odds, sport, game_date) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, game, amount, odds, sport, game_date]
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
            res.json(rows || []);
        }
    );
});

/**
 * Cancel Bet Endpoint
 * Allows users to cancel their bets if the game hasn't started yet
 */
app.post('/cancel-bet/:betId', authenticateToken, async (req, res) => {
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

                // Check if game has started
                const gameDate = new Date(bet.game_date);
                if (gameDate < new Date()) {
                    return res.status(400).json({ error: "Cannot cancel bet after game has started" });
                }

                // Start a transaction to update user balance and delete bet
                db.run("BEGIN TRANSACTION");

                try {
                    // Refund the bet amount to user's balance
                    await new Promise((resolve, reject) => {
                        db.run(
                            "UPDATE users SET balance = balance + ? WHERE id = ?",
                            [bet.amount, userId],
                            (err) => {
                                if (err) reject(err);
                                resolve();
                            }
                        );
                    });

                    // Delete the bet
                    await new Promise((resolve, reject) => {
                        db.run(
                            "DELETE FROM bets WHERE id = ? AND user_id = ?",
                            [betId, userId],
                            (err) => {
                                if (err) reject(err);
                                resolve();
                            }
                        );
                    });

                    // Commit the transaction
                    db.run("COMMIT");
                    res.json({ message: "Bet cancelled successfully" });
                } catch (error) {
                    // Rollback on error
                    db.run("ROLLBACK");
                    console.error('Transaction error:', error);
                    res.status(500).json({ error: "Failed to cancel bet" });
                }
            }
        );
    } catch (error) {
        console.error('Error cancelling bet:', error);
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
