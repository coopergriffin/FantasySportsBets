/**
 * Database Utilities
 * 
 * Provides a clean interface for database operations and connection management.
 * Implements the repository pattern for better separation of concerns.
 */

const sqlite3 = require('sqlite3').verbose();
const config = require('./config');

class Database {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize database connection
   * @returns {Promise<void>}
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(config.server.database.path, (err) => {
        if (err) {
          console.error('Error connecting to database:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database.');
          resolve();
        }
      });
    });
  }

  /**
   * Initialize database schema
   * @returns {Promise<void>}
   */
  async initSchema() {
    const queries = [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        email TEXT UNIQUE,
        balance INTEGER DEFAULT 1000,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS bets (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        game TEXT,
        amount INTEGER,
        odds REAL,
        outcome TEXT,
        sport TEXT,
        game_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`
    ];

    for (const query of queries) {
      await this.run(query);
    }
  }

  /**
   * Run a query with parameters
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<void>}
   */
  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        resolve(this);
      });
    });
  }

  /**
   * Get a single row
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>}
   */
  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
  }

  /**
   * Get multiple rows
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Array>}
   */
  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });
  }

  /**
   * Close database connection
   * @returns {Promise<void>}
   */
  async close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        resolve();
      });
    });
  }
}

// Export a singleton instance
const database = new Database();
module.exports = database; 