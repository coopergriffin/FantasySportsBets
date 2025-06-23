/**
 * Jest Configuration
 * 
 * Configures Jest testing framework for both backend and frontend testing.
 * Includes setup for code coverage, environment variables, and test paths.
 */

module.exports = {
  // Test environment setup
  testEnvironment: 'node',
  
  // File patterns to look for tests
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  
  // Files to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/client/node_modules/'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: [
    'server.js',
    'utils/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  
  // Setup files
  setupFiles: ['./tests/setup.js'],
  
  // Environment variables for testing
  setupFilesAfterEnv: ['./tests/setupAfterEnv.js'],
  
  // Module name mapper for client-side testing
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/tests/__mocks__/fileMock.js'
  },
  
  // Transform configuration
  transform: {
    '^.+\\.jsx?$': 'babel-jest'
  },
  
  // Verbose output for detailed test results
  verbose: true
}; 