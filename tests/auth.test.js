/**
 * Authentication Utilities Tests
 * 
 * Tests the JWT token generation, verification, and refresh token functionality.
 */

const {
  generateAccessToken,
  generateRefreshToken,
  refreshAccessToken,
  authenticateToken
} = require('../utils/auth');
const jwt = require('jsonwebtoken');
const config = require('../config');

describe('Authentication Utilities', () => {
  const mockUser = {
    id: 1,
    username: 'testuser'
  };

  const mockReq = {
    headers: {},
    user: null
  };

  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };

  const mockNext = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq.headers = {};
    mockReq.user = null;
  });

  describe('generateAccessToken', () => {
    it('should generate a valid JWT access token', () => {
      const token = generateAccessToken(mockUser);
      const decoded = jwt.verify(token, config.server.auth.jwtSecret);
      
      expect(decoded).toHaveProperty('userId', mockUser.id);
      expect(decoded).toHaveProperty('username', mockUser.username);
      expect(decoded).toHaveProperty('exp');
      expect(decoded).toHaveProperty('iat');
    });

    it('should generate a token that expires in 15 minutes', () => {
      const token = generateAccessToken(mockUser);
      const decoded = jwt.verify(token, config.server.auth.jwtSecret);
      
      const expiration = new Date(decoded.exp * 1000);
      const now = new Date();
      const diff = Math.round((expiration - now) / 1000 / 60);
      
      expect(diff).toBeLessThanOrEqual(15);
      expect(diff).toBeGreaterThan(14);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid JWT refresh token', () => {
      const token = generateRefreshToken(mockUser);
      const decoded = jwt.verify(token, config.server.auth.refreshTokenSecret);
      
      expect(decoded).toHaveProperty('userId', mockUser.id);
      expect(decoded).toHaveProperty('exp');
      expect(decoded).toHaveProperty('iat');
    });

    it('should generate a token that expires in 7 days', () => {
      const token = generateRefreshToken(mockUser);
      const decoded = jwt.verify(token, config.server.auth.refreshTokenSecret);
      
      const expiration = new Date(decoded.exp * 1000);
      const now = new Date();
      const diff = Math.round((expiration - now) / 1000 / 60 / 60 / 24);
      
      expect(diff).toBeLessThanOrEqual(7);
      expect(diff).toBeGreaterThan(6);
    });
  });

  describe('authenticateToken middleware', () => {
    it('should return 401 if no token is provided', () => {
      authenticateToken(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if token is invalid', () => {
      mockReq.headers.authorization = 'Bearer invalid_token';
      
      authenticateToken(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next() with valid token', () => {
      const token = generateAccessToken(mockUser);
      mockReq.headers.authorization = `Bearer ${token}`;
      
      authenticateToken(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toHaveProperty('userId', mockUser.id);
      expect(mockReq.user).toHaveProperty('username', mockUser.username);
    });
  });

  describe('refreshAccessToken', () => {
    it('should generate new access token from valid refresh token', async () => {
      const refreshToken = generateRefreshToken(mockUser);
      const newAccessToken = await refreshAccessToken(refreshToken);
      
      const decoded = jwt.verify(newAccessToken, config.server.auth.jwtSecret);
      expect(decoded).toHaveProperty('userId', mockUser.id);
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(refreshAccessToken('invalid_token'))
        .rejects
        .toThrow('Invalid refresh token');
    });
  });
}); 