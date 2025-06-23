/**
 * Type Definitions
 * 
 * JSDoc type definitions for the application.
 * These types help with code documentation and IDE support.
 * They also make it easier to migrate to TypeScript in the future.
 */

/**
 * @typedef {Object} User
 * @property {number} id - User's unique identifier
 * @property {string} username - User's username
 * @property {string} email - User's email address
 * @property {number} balance - User's current balance
 * @property {string} created_at - Timestamp of account creation
 */

/**
 * @typedef {Object} Bet
 * @property {number} id - Bet's unique identifier
 * @property {number} user_id - ID of user who placed the bet
 * @property {string} game - Description of the game
 * @property {number} amount - Bet amount
 * @property {number} odds - Odds at time of bet
 * @property {('pending'|'won'|'lost')} outcome - Bet outcome
 * @property {string} created_at - Timestamp of bet placement
 */

/**
 * @typedef {Object} Game
 * @property {string} home_team - Home team name
 * @property {string} away_team - Away team name
 * @property {number} odds - Current odds
 * @property {string} start_time - Game start time
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - Whether the request was successful
 * @property {string} [message] - Optional success message
 * @property {string} [error] - Optional error message
 * @property {*} [data] - Optional response data
 */

/**
 * @typedef {Object} LoginCredentials
 * @property {string} username - User's username
 * @property {string} password - User's password
 */

/**
 * @typedef {Object} RegistrationData
 * @property {string} username - Desired username
 * @property {string} email - User's email
 * @property {string} password - Desired password
 * @property {string} confirmPassword - Password confirmation
 */

// Export empty object since this file is for documentation only
module.exports = {}; 