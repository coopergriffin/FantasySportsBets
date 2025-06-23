/**
 * Test Setup Configuration
 * 
 * Configures the test environment before running tests.
 * Sets up environment variables and global test utilities.
 */

const config = require('../config');
const database = require('../db');

// Set test environment
process.env.NODE_ENV = 'test';

// Mock environment variables
process.env.JWT_SECRET = config.test.auth.jwtSecret;
process.env.REFRESH_TOKEN_SECRET = config.test.auth.refreshTokenSecret;

// Global test utilities
global.testUtils = {
  /**
   * Creates a test user in the database
   * @param {Object} userData - User data to create
   * @returns {Promise<Object>} Created user object
   */
  createTestUser: async (userData = {}) => {
    const defaultUser = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'TestPassword123',
      balance: 1000
    };

    const user = { ...defaultUser, ...userData };
    
    const result = await database.run(
      'INSERT INTO users (username, email, password, balance) VALUES (?, ?, ?, ?)',
      [user.username, user.email, user.password, user.balance]
    );

    return { ...user, id: result.lastID };
  },

  /**
   * Cleans up the test database
   * @returns {Promise<void>}
   */
  cleanupDatabase: async () => {
    await database.run('DELETE FROM bets');
    await database.run('DELETE FROM users');
  },

  /**
   * Creates a test bet in the database
   * @param {Object} betData - Bet data to create
   * @returns {Promise<Object>} Created bet object
   */
  createTestBet: async (betData = {}) => {
    const defaultBet = {
      user_id: 1,
      game: 'Test Team vs Other Team',
      amount: 100,
      odds: 1.5,
      outcome: 'pending'
    };

    const bet = { ...defaultBet, ...betData };
    
    const result = await database.run(
      'INSERT INTO bets (user_id, game, amount, odds, outcome) VALUES (?, ?, ?, ?, ?)',
      [bet.user_id, bet.game, bet.amount, bet.odds, bet.outcome]
    );

    return { ...bet, id: result.lastID };
  }
};

// Setup test database connection
beforeAll(async () => {
  await database.connect();
  await database.initSchema();
});

// Cleanup after tests
afterAll(async () => {
  await database.close();
}); 