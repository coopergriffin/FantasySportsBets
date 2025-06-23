/**
 * Validation Utilities
 * 
 * Centralizes validation logic for both client and server-side validation.
 * Provides consistent validation rules across the application.
 */

const { check } = require('express-validator');

/**
 * User registration validation rules
 */
const registerValidation = [
  check('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores and dashes'),
  
  check('email')
    .trim()
    .isEmail()
    .withMessage('Must provide a valid email')
    .normalizeEmail(),
  
  check('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/\d/)
    .withMessage('Password must contain at least one number')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
];

/**
 * Login validation rules
 */
const loginValidation = [
  check('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required'),
  
  check('password')
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * Bet placement validation rules
 */
const betValidation = [
  check('userId')
    .isInt()
    .withMessage('Invalid user ID'),
  
  check('game')
    .trim()
    .notEmpty()
    .withMessage('Game information is required'),
  
  check('amount')
    .isInt({ min: 1 })
    .withMessage('Bet amount must be a positive number'),
  
  check('odds')
    .isFloat()
    .withMessage('Invalid odds value')
];

/**
 * Client-side form validation
 * @param {Object} formData - Form data to validate
 * @returns {string|null} Error message if validation fails, null if passes
 */
const validateRegistrationForm = (formData) => {
  const { username, email, password, confirmPassword } = formData;

  if (password !== confirmPassword) {
    return "Passwords do not match";
  }

  if (password.length < 6) {
    return "Password must be at least 6 characters long";
  }

  if (!/\d/.test(password)) {
    return "Password must contain at least one number";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }

  if (!email.includes('@')) {
    return "Please enter a valid email address";
  }

  if (username.length < 3 || username.length > 30) {
    return "Username must be between 3 and 30 characters";
  }

  if (!/^[A-Za-z0-9_-]+$/.test(username)) {
    return "Username can only contain letters, numbers, underscores and dashes";
  }

  return null;
};

module.exports = {
  registerValidation,
  loginValidation,
  betValidation,
  validateRegistrationForm
}; 