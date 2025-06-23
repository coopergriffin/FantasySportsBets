/**
 * Login Component
 * 
 * Handles user authentication by providing a login form and managing
 * the login process through the API. Includes error handling and
 * success callbacks.
 */

import React, { useState } from 'react';
import { login } from '../api';
import './Login.css';

const Login = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            console.log('Attempting login with:', { username });
            const data = await login({ username, password });
            console.log('Login successful:', { username });
            onLogin(data);
        } catch (err) {
            console.error('Login error:', err);
            setError(err.message || 'Network error. Please check if the server is running and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <div className="login-header">
                    <h1>Welcome to BetSmart</h1>
                    <p className="subtitle">Your Trusted Fantasy Sports Betting Platform</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            placeholder="Enter your username"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="Enter your password"
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" className="login-button" disabled={isLoading}>
                        {isLoading ? 'Signing In...' : 'Sign In'}
                    </button>

                    <div className="login-options">
                        <a href="#forgot-password">Forgot Password?</a>
                        <span className="separator">|</span>
                        <a href="#register">Create Account</a>
                    </div>
                </form>

                <div className="legal-disclaimer">
                    <p className="disclaimer-title">Important Notice</p>
                    <p>By accessing this platform, you acknowledge that:</p>
                    <ul>
                        <li>You are at least 18 years of age or the legal age in your jurisdiction</li>
                        <li>Fantasy sports betting may be regulated in your jurisdiction</li>
                        <li>You accept our Terms of Service and Privacy Policy</li>
                        <li>You understand that betting involves financial risk</li>
                    </ul>
                    <p className="responsible-gaming">
                        BetSmart promotes responsible gaming. If you or someone you know has a gambling problem, 
                        call 1-800-GAMBLER for confidential support.
                    </p>
                </div>

                <div className="security-badges">
                    <span>🔒 Secure Login</span>
                    <span>✓ Licensed & Regulated</span>
                    <span>🛡️ SSL Encrypted</span>
                </div>
            </div>
        </div>
    );
};

export default Login; 