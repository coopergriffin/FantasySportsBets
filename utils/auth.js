/**
 * Authentication Utilities
 * 
 * Handles JWT token generation, verification, and refresh token functionality.
 * Provides middleware for protecting routes and managing user sessions.
 */

const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Generate access token for user
 * @param {Object} user - User object (without password)
 * @returns {string} JWT access token
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    { userId: user.id, username: user.username },
    config.server.auth.jwtSecret,
    { expiresIn: '15m' }
  );
};

/**
 * Generate refresh token for user
 * @param {Object} user - User object (without password)
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user.id },
    config.server.auth.refreshTokenSecret,
    { expiresIn: '7d' }
  );
};

/**
 * Verify access token middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, config.server.auth.jwtSecret, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      return res.status(403).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
  });
};

/**
 * Verify refresh token and generate new access token
 * @param {string} refreshToken - JWT refresh token
 * @returns {Promise<string>} New access token
 * @throws {Error} If refresh token is invalid
 */
const refreshAccessToken = async (refreshToken) => {
  try {
    const decoded = jwt.verify(refreshToken, config.server.auth.refreshTokenSecret);
    const user = { id: decoded.userId };
    return generateAccessToken(user);
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

/**
 * Rate limiting middleware
 * Simple implementation - for production, use redis or similar
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const rateLimiter = (() => {
  const requests = new Map();
  const limit = 100; // requests
  const timeWindow = 15 * 60 * 1000; // 15 minutes

  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    
    if (requests.has(ip)) {
      const { count, firstRequest } = requests.get(ip);
      
      if (now - firstRequest > timeWindow) {
        requests.set(ip, { count: 1, firstRequest: now });
        next();
      } else if (count >= limit) {
        res.status(429).json({ error: 'Too many requests' });
      } else {
        requests.set(ip, { count: count + 1, firstRequest });
        next();
      }
    } else {
      requests.set(ip, { count: 1, firstRequest: now });
      next();
    }
  };
})();

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  authenticateToken,
  refreshAccessToken,
  rateLimiter
}; 