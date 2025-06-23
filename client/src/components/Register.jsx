/**
 * Register Component
 * 
 * Provides user registration functionality with form validation
 * and error handling. Creates new user accounts through the API.
 */

import React, { useState } from 'react';           // React hook for component state
import './Register.css';                   // Component styles

/**
 * Registration form component
 * @param {Object} props - Component props
 * @param {Function} props.onRegister - Callback function called after successful registration
 */
const Register = ({ onRegister }) => {
  // Form state
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');  // Error message state
  const [isLoading, setIsLoading] = useState(false); // Loading state

  /**
   * Handles input field changes
   * Updates form state with new values
   * @param {Event} e - Input change event
   */
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  /**
   * Handles form submission
   * Validates input and attempts to register new user
   * @param {Event} e - Form submission event
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          email: formData.email
        }),
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        onRegister(data);
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (err) {
      setError('Network error. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-box">
        <div className="register-header">
          <h1>Create Your BetSmart Account</h1>
          <p className="subtitle">Join the Premier Fantasy Sports Betting Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-group">
            <label htmlFor="username">Username*</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder="Choose a username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
            />
            <small className="field-hint">Used for account recovery and important notifications</small>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password*</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Create a strong password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password*</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Confirm your password"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="register-button" disabled={isLoading}>
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>

          <p className="terms-text">
            By creating an account, you agree to BetSmart's Terms of Service, 
            Privacy Policy, and responsible gaming practices.
          </p>
        </form>

        <div className="legal-disclaimer">
          <p className="disclaimer-title">Important Notice</p>
          <p>By registering, you confirm that:</p>
          <ul>
            <li>You are at least 18 years of age or the legal age in your jurisdiction</li>
            <li>The information provided is accurate and complete</li>
            <li>You understand that fantasy sports betting may be regulated in your jurisdiction</li>
            <li>You accept responsibility for maintaining your account security</li>
          </ul>
        </div>

        <div className="security-badges">
          <span>🔒 Secure Registration</span>
          <span>✓ Licensed & Regulated</span>
          <span>🛡️ SSL Encrypted</span>
        </div>
      </div>
    </div>
  );
};

export default Register; 