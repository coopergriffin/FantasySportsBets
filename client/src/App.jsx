/**
 * Main Application Component
 * 
 * This is the root component of the Fantasy Sports Betting application.
 * It handles user authentication state and renders either the auth forms
 * or the main betting interface.
 */

import { useState, useEffect } from "react"; // React hooks for state and side effects
import Register from "./components/Register"; // User registration component
import Login from "./components/Login";       // User login component
import BettingHistory from "./components/BettingHistory";
import { fetchOdds, placeBet as placeBetApi, logout } from "./api"; // API communication functions
import "./App.css";                          // Component styles
import Leaderboard from './components/Leaderboard';

function App() {
  // Application state
  const [user, setUser] = useState(null);           // Logged in user data
  const [showRegister, setShowRegister] = useState(false); // Toggle between login/register
  const [odds, setOdds] = useState([]);             // Available betting odds
  const [error, setError] = useState(null);
  const [selectedSport, setSelectedSport] = useState('all');
  const [selectedAmount, setSelectedAmount] = useState(5);
  const [customAmount, setCustomAmount] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedBets, setExpandedBets] = useState({});
  const [betsRefreshTrigger, setBetsRefreshTrigger] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);

  const SPORTS = [
    { value: 'all', label: 'All Sports' },
    { value: 'NFL', label: 'NFL' },
    { value: 'NBA', label: 'NBA' },
    { value: 'MLB', label: 'MLB' },
    { value: 'NHL', label: 'NHL' }
  ];

  const BET_AMOUNTS = [5, 25, 50, 100];

  /**
   * Effect hook to fetch odds when user logs in or sport changes
   */
  useEffect(() => {
    const loadGames = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        const response = await fetchOdds(1, selectedSport);
        setOdds(response.games || []);
        setPagination(response.pagination);
        setError(null);
      } catch (error) {
        console.error('Error fetching odds:', error);
        setError('Failed to fetch odds');
      } finally {
        setIsLoading(false);
      }
    };

    loadGames();
  }, [user, selectedSport]);

  /**
   * Loads games with pagination
   * @param {number} page - The page number to load
   * @param {boolean} append - Whether to append to existing games or replace them
   */
  const loadGames = async (page, append = false) => {
    try {
      setIsLoading(true);
      const response = await fetchOdds(page, selectedSport);
      setError(null);
      setPagination(response.pagination);
      
      if (append) {
        setOdds(prev => [...prev, ...response.games]);
      } else {
        setOdds(response.games);
      }
      setCurrentPage(page);
    } catch (error) {
      console.error("Error fetching odds:", error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles loading more games
   */
  const handleLoadMore = () => {
    if (pagination?.hasMore) {
      loadGames(currentPage + 1, true);
    }
  };

  /**
   * Handles successful user login
   * @param {Object} response - The response object returned from the server
   */
  const handleLoginSuccess = (response) => {
    console.log('Login success, user data:', response.user);
    localStorage.setItem('token', response.token);
    setUser(response.user);
  };

  /**
   * Handles successful registration
   * Switches view back to login form
   */
  const handleRegisterSuccess = () => {
    setShowRegister(false);
  };

  /**
   * Handles placing a bet on a game
   * Updates user balance on successful bet
   * @param {Object} game - The game data to bet on
   * @param {number} amount - The bet amount
   */
  const handlePlaceBet = async (game, amount) => {
    if (!user) {
      alert("Please log in to place bets");
      return;
    }

    if (user.balance < amount) {
      alert("Insufficient balance");
      return;
    }

    try {
      const response = await placeBetApi({
        game: `${game.homeTeam} vs ${game.awayTeam}`,
        amount: amount,
        odds: game.odds[0]?.price || 0,
        sport: game.sport,
        game_date: game.commenceTime
      });

      if (response.success) {
        setUser(prevUser => ({
          ...prevUser,
          balance: response.newBalance
        }));
        // Close bet options after successful bet
        setExpandedBets(prev => ({
          ...prev,
          [game.id]: false
        }));
        // Trigger betting history refresh
        setBetsRefreshTrigger(prev => prev + 1);
        alert("Bet placed successfully!");
      }
    } catch (error) {
      alert(error.message || "Failed to place bet");
    }
  };

  /**
   * Handles user logout
   * Clears user data and odds
   */
  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setOdds([]);
    setError(null);
  };

  const handleBetCancelled = async () => {
    // Refresh user data to update balance
    try {
      const response = await fetch('http://localhost:5000/user', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch user data');
      }

      const userData = await response.json();
      setUser(userData);
      
      // Increment the refresh trigger to update betting history
      setBetsRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error fetching user data:', error);
      alert('Failed to update user data. Please refresh the page.');
    }
  };

  // Render authentication forms if no user is logged in
  if (!user) {
    return (
      <div className="app">
        {!user ? (
          <div className="auth-container">
            {showRegister ? (
              <>
                <Register onRegisterSuccess={handleRegisterSuccess} />
                <button onClick={() => setShowRegister(false)}>
                  Already have an account? Login
                </button>
              </>
            ) : (
              <>
                <Login onLogin={handleLoginSuccess} />
                <button onClick={() => setShowRegister(true)}>
                  Need an account? Register
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="user-info">
              <span>Welcome, {user.username}!</span>
              <span>Balance: ${user.balance}</span>
              <button onClick={handleLogout}>Logout</button>
              <button onClick={() => setShowLeaderboard(!showLeaderboard)}>
                {showLeaderboard ? 'Show Games' : 'Show Leaderboard'}
              </button>
            </div>

            {showLeaderboard ? (
              <Leaderboard />
            ) : (
              <>
                <div className="controls">
                  <div className="sport-selector">
                    <label>Select Sport:</label>
                    <select 
                      value={selectedSport} 
                      onChange={(e) => setSelectedSport(e.target.value)}
                    >
                      {SPORTS.map(sport => (
                        <option key={sport.value} value={sport.value}>
                          {sport.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="games-container">
                  {isLoading ? (
                    <div className="loading">Loading games...</div>
                  ) : error ? (
                    <div className="error">{error}</div>
                  ) : odds.length === 0 ? (
                    <div className="no-games">No games available for the selected sport.</div>
                  ) : (
                    odds.map((game) => (
                      <div key={game.id} className="game-card">
                        <div className="game-header">
                          <span className="sport-tag">{game.sport}</span>
                          <span className="game-time">
                            {new Date(game.commenceTime).toLocaleString()} 
                            ({new Date(game.commenceTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
                          </span>
                        </div>
                        <h3>{game.homeTeam} vs {game.awayTeam}</h3>
                        <div className="odds-display">
                          {game.odds && game.odds.length > 0 && (
                            <div className="odds-info">
                              <p>{game.homeTeam}: {game.odds[0]?.price > 0 ? '+' : ''}{game.odds[0]?.price}</p>
                              <p>{game.awayTeam}: {game.odds[1]?.price > 0 ? '+' : ''}{game.odds[1]?.price}</p>
                            </div>
                          )}
                          <button 
                            className="bet-button"
                            onClick={() => setExpandedBets(prev => ({
                              ...prev,
                              [game.id]: !prev[game.id]
                            }))}
                          >
                            {expandedBets[game.id] ? 'Cancel' : 'Place Bet'}
                          </button>
                          {expandedBets[game.id] && (
                            <div className="betting-options">
                              <div className="team-selection">
                                <button 
                                  className={`team-button ${selectedTeam === game.homeTeam ? 'selected' : ''}`}
                                  onClick={() => setSelectedTeam(game.homeTeam)}
                                >
                                  {game.homeTeam}
                                </button>
                                <button 
                                  className={`team-button ${selectedTeam === game.awayTeam ? 'selected' : ''}`}
                                  onClick={() => setSelectedTeam(game.awayTeam)}
                                >
                                  {game.awayTeam}
                                </button>
                              </div>
                              <div className="bet-amounts">
                                {BET_AMOUNTS.map(amount => (
                                  <button
                                    key={amount}
                                    className={selectedAmount === amount ? 'selected' : ''}
                                    onClick={() => {
                                      setSelectedAmount(amount);
                                      setCustomAmount('');
                                    }}
                                  >
                                    ${amount}
                                  </button>
                                ))}
                                <input
                                  type="number"
                                  placeholder="Custom amount"
                                  value={customAmount}
                                  onChange={(e) => {
                                    setCustomAmount(e.target.value);
                                    setSelectedAmount(null);
                                  }}
                                  min="1"
                                />
                              </div>
                              <button 
                                className="confirm-bet-button"
                                disabled={!selectedTeam || (!selectedAmount && !customAmount)}
                                onClick={() => handlePlaceBet(game, customAmount || selectedAmount)}
                              >
                                Confirm Bet
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {!isLoading && pagination?.hasMore && (
                  <button onClick={handleLoadMore} className="load-more-button">
                    Load More Games
                  </button>
                )}

                <BettingHistory
                  userId={user.id}
                  refreshTrigger={betsRefreshTrigger}
                  onBetCancelled={handleBetCancelled}
                />
              </>
            )}
          </>
        )}
      </div>
    );
  }

  // Render main application interface for logged in users
  return (
    <div className="app">
      {!user ? (
        <div className="auth-container">
          {showRegister ? (
            <>
              <Register onRegisterSuccess={handleRegisterSuccess} />
              <button onClick={() => setShowRegister(false)}>
                Already have an account? Login
              </button>
            </>
          ) : (
            <>
              <Login onLogin={handleLoginSuccess} />
              <button onClick={() => setShowRegister(true)}>
                Need an account? Register
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="user-info">
            <span>Welcome, {user.username}!</span>
            <span>Balance: ${user.balance}</span>
            <button onClick={handleLogout}>Logout</button>
            <button onClick={() => setShowLeaderboard(!showLeaderboard)}>
              {showLeaderboard ? 'Show Games' : 'Show Leaderboard'}
            </button>
          </div>

          {showLeaderboard ? (
            <Leaderboard />
          ) : (
            <>
              <div className="controls">
                <div className="sport-selector">
                  <label>Select Sport:</label>
                  <select 
                    value={selectedSport} 
                    onChange={(e) => setSelectedSport(e.target.value)}
                  >
                    {SPORTS.map(sport => (
                      <option key={sport.value} value={sport.value}>
                        {sport.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="games-container">
                {isLoading ? (
                  <div className="loading">Loading games...</div>
                ) : error ? (
                  <div className="error">{error}</div>
                ) : odds.length === 0 ? (
                  <div className="no-games">No games available for the selected sport.</div>
                ) : (
                  odds.map((game) => (
                    <div key={game.id} className="game-card">
                      <div className="game-header">
                        <span className="sport-tag">{game.sport}</span>
                        <span className="game-time">
                          {new Date(game.commenceTime).toLocaleString()} 
                          ({new Date(game.commenceTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
                        </span>
                      </div>
                      <h3>{game.homeTeam} vs {game.awayTeam}</h3>
                      <div className="odds-display">
                        {game.odds && game.odds.length > 0 && (
                          <div className="odds-info">
                            <p>{game.homeTeam}: {game.odds[0]?.price > 0 ? '+' : ''}{game.odds[0]?.price}</p>
                            <p>{game.awayTeam}: {game.odds[1]?.price > 0 ? '+' : ''}{game.odds[1]?.price}</p>
                          </div>
                        )}
                        <button 
                          className="bet-button"
                          onClick={() => setExpandedBets(prev => ({
                            ...prev,
                            [game.id]: !prev[game.id]
                          }))}
                        >
                          {expandedBets[game.id] ? 'Cancel' : 'Place Bet'}
                        </button>
                        {expandedBets[game.id] && (
                          <div className="betting-options">
                            <div className="team-selection">
                              <button 
                                className={`team-button ${selectedTeam === game.homeTeam ? 'selected' : ''}`}
                                onClick={() => setSelectedTeam(game.homeTeam)}
                              >
                                {game.homeTeam}
                              </button>
                              <button 
                                className={`team-button ${selectedTeam === game.awayTeam ? 'selected' : ''}`}
                                onClick={() => setSelectedTeam(game.awayTeam)}
                              >
                                {game.awayTeam}
                              </button>
                            </div>
                            <div className="bet-amounts">
                              {BET_AMOUNTS.map(amount => (
                                <button
                                  key={amount}
                                  className={selectedAmount === amount ? 'selected' : ''}
                                  onClick={() => {
                                    setSelectedAmount(amount);
                                    setCustomAmount('');
                                  }}
                                >
                                  ${amount}
                                </button>
                              ))}
                              <input
                                type="number"
                                placeholder="Custom amount"
                                value={customAmount}
                                onChange={(e) => {
                                  setCustomAmount(e.target.value);
                                  setSelectedAmount(null);
                                }}
                                min="1"
                              />
                            </div>
                            <button 
                              className="confirm-bet-button"
                              disabled={!selectedTeam || (!selectedAmount && !customAmount)}
                              onClick={() => handlePlaceBet(game, customAmount || selectedAmount)}
                            >
                              Confirm Bet
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {!isLoading && pagination?.hasMore && (
                <button onClick={handleLoadMore} className="load-more-button">
                  Load More Games
                </button>
              )}

              <BettingHistory
                userId={user.id}
                refreshTrigger={betsRefreshTrigger}
                onBetCancelled={handleBetCancelled}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

export default App;
