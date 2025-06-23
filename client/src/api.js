/**
 * API communication functions for the Fantasy Sports Betting application.
 * These functions handle all HTTP requests to the backend server.
 */

const API_BASE_URL = 'http://localhost:5000';

// Store auth token in memory
let authToken = null;

/**
 * Sets the authentication token for API requests
 * @param {string} token - JWT access token
 */
const setAuthToken = (token) => {
  authToken = token;
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
};

/**
 * Creates headers with authentication token if available
 * @returns {Object} Headers object
 */
const createHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
  };

  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

/**
 * Sends a login request to the server
 * @param {Object} credentials - User login credentials
 * @returns {Promise<Object>} User data if successful
 */
export const login = async (credentials) => {
  try {
    console.log('Sending login request to:', `${API_BASE_URL}/login`);
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || data.message || 'Login failed');
    }

    const data = await response.json();
    if (data.token) {
      setAuthToken(data.token);
    }
    
    return data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

/**
 * Sends a registration request to the server
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} Success message if registration successful
 */
export const register = async (userData) => {
  const response = await fetch(`${API_BASE_URL}/register`, {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify(userData),
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Registration failed');
  }

  return response.json();
};

/**
 * Fetches current odds from the server
 * @param {number} page - The page number to fetch
 * @param {string} sport - The sport to filter by
 * @returns {Promise<Object>} Object containing games array and pagination info
 */
export const fetchOdds = async (page = 1, sport = 'all') => {
  try {
    console.log('Fetching odds:', { page, sport });
    const response = await fetch(`${API_BASE_URL}/api/odds?page=${page}&sport=${sport}`, {
      headers: createHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch odds');
    }

    const data = await response.json();
    console.log('Odds data received:', data);
    return {
      games: data.data || [],
      pagination: {
        currentPage: data.page,
        totalPages: data.totalPages,
        hasMore: data.page < data.totalPages
      }
    };
  } catch (error) {
    console.error('Error fetching odds:', error);
    throw error;
  }
};

/**
 * Places a bet on a game
 * @param {Object} betData - Bet details including game and amount
 * @returns {Promise<Object>} Bet confirmation and updated balance
 */
export const placeBet = async (betData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/bets`, {
      method: 'POST',
      headers: {
        ...createHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(betData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to place bet');
    }

    return await response.json();
  } catch (error) {
    console.error('Error placing bet:', error);
    throw error;
  }
};

/**
 * Logs out the user by clearing the auth token
 */
export const logout = () => {
  setAuthToken(null);
};

/**
 * Fetches betting history for a user
 * @param {number} userId - The ID of the user
 * @returns {Promise<Array>} Array of user's bets
 */
export const fetchBets = async (userId) => {
  const response = await fetch(`${API_BASE_URL}/bets/${userId}`, {
    headers: createHeaders(),
    credentials: 'include'
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch betting history');
  }

  return response.json();
}; 