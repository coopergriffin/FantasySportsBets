/**
 * Main Application Component
 * 
 * This is the root component of the Fantasy Sports Betting application.
 * It handles user authentication state and renders either the auth forms
 * or the main betting interface.
 */

import { useState, useEffect, useCallback } from "react"; // React hooks for state and side effects
import Register from "./components/Register"; // User registration component
import Login from "./components/Login";       // User login component
import BettingPanel from "./components/BettingPanel"; // User betting panel with active bets and history
import Leaderboard from './components/Leaderboard'; // Global leaderboard component
import Notification from './components/Notification'; // Notification component
import Header from './components/Header'; // Header with logo and navigation
import MainLayout from './components/MainLayout'; // Main layout with sidebar ads
import AdComponent from './components/AdComponent'; // Advertisement component
import { fetchOdds, placeBet as placeBetApi, resolveCompletedGames, updateUserTimezone } from "./api"; // API communication functions
import { formatTimeForDisplay } from "./utils/timeUtils"; // Time formatting utilities
import { calculateWinnings, formatOdds } from "./utils/oddsUtils"; // Odds calculation utilities
import "./App.css"; // Component styles

function App() {
  // Authentication state
  const [user, setUser] = useState(null); // Logged in user data
  const [showRegister, setShowRegister] = useState(false); // Toggle between login/register

  // Betting interface state
  const [odds, setOdds] = useState([]); // Available betting odds
  const [selectedSport, setSelectedSport] = useState('NFL'); // Currently selected sport filter
  const [selectedAmount, setSelectedAmount] = useState(null); // Selected bet amount
  const [customAmount, setCustomAmount] = useState(''); // Custom bet amount input
  const [selectedTeam, setSelectedTeam] = useState(null); // Selected team for betting
  const [expandedBets, setExpandedBets] = useState({}); // Track which bet options are expanded

  // UI state
  const [error, setError] = useState(null); // Error messages
  const [isLoading, setIsLoading] = useState(false); // Loading state
  const [showLeaderboard, setShowLeaderboard] = useState(false); // Toggle leaderboard view
  const [notification, setNotification] = useState({ visible: false, message: '', type: 'info' }); // Notification state

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1); // Current page for odds
  const [pagination, setPagination] = useState({}); // Pagination metadata

  // Refresh triggers
  const [betsRefreshTrigger, setBetsRefreshTrigger] = useState(0); // Force betting history refresh
  const [gamesRefreshTrigger, setGamesRefreshTrigger] = useState(0); // Force games refresh
  const [isRefreshingGames, setIsRefreshingGames] = useState(false); // Games refresh loading state
  const [lastGamesRefresh, setLastGamesRefresh] = useState(null); // Track last games refresh time

  // Constants
  const SPORTS = [
    { value: 'NFL', label: 'NFL' },
    { value: 'NBA', label: 'NBA' },
    { value: 'MLB', label: 'MLB' },
    { value: 'NHL', label: 'NHL' }
  ];

  const BET_AMOUNTS = [5, 25, 50, 100];

  /**
   * Shows a notification message
   * @param {string} message - The notification message
   * @param {string} type - The notification type ('success', 'error', 'warning', 'info')
   */
  const showNotification = (message, type = 'info') => {
    setNotification({ visible: true, message, type });
  };

  /**
   * Closes the notification
   */
  const closeNotification = () => {
    setNotification({ visible: false, message: '', type: 'info' });
  };

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
        
        // Auto-refresh betting history and check for completed games when user enters page
        setBetsRefreshTrigger(prev => prev + 1);
        
        // Auto-check for completed games using real API data
        handleRefreshBets();
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
   * Effect hook to handle page visibility changes
   * Auto-refreshes betting data when user returns to the tab/window
   */
  useEffect(() => {
    if (!user) return;

    let lastVisibilityRefresh = 0;
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const now = Date.now();
        // Only refresh if it's been more than 30 seconds since last refresh
        if (now - lastVisibilityRefresh > 30000) {
          console.log('🔄 User returned to page, auto-refreshing betting data...');
          setBetsRefreshTrigger(prev => prev + 1);
          handleRefreshBets();
          lastVisibilityRefresh = now;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  /**
   * Effect hook to auto-refresh betting data on page load
   * Ensures fresh data whenever user accesses the app
   */
  useEffect(() => {
    if (!user) return;

    // Only auto-refresh betting data on initial login, not on every re-render
    const hasAutoRefreshed = sessionStorage.getItem('hasAutoRefreshed');
    if (!hasAutoRefreshed) {
      const timeoutId = setTimeout(() => {
        console.log('🔄 Auto-refreshing betting data on initial page load...');
        handleRefreshBets();
        sessionStorage.setItem('hasAutoRefreshed', 'true');
      }, 1000); // Longer delay to prevent conflicts

      return () => clearTimeout(timeoutId);
    }
  }, [user?.id]); // Trigger when user ID changes (login/logout)

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
    // Betting history refresh now happens in useEffect when user is set
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
   * @param {string} selectedTeam - The team the user is betting on
   * @param {number} selectedOdds - The odds for the selected team
   */
  const handlePlaceBet = async (game, amount, selectedTeam, selectedOdds) => {
    if (!user) {
      showNotification("Please log in to place bets", "warning");
      return;
    }

    if (user.balance < amount) {
      showNotification("Insufficient balance", "error");
      return;
    }

    try {
      const response = await placeBetApi({
        game: `${game.homeTeam} vs ${game.awayTeam}`,
        team: selectedTeam,
        amount: amount,
        odds: selectedOdds,
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
        // Reset selections
        setSelectedTeam(null);
        setSelectedAmount(null);
        setCustomAmount('');
        // Trigger betting history refresh
        setBetsRefreshTrigger(prev => prev + 1);
        
        // Show appropriate success message based on odds updates
        if (response.oddsUpdated) {
          showNotification(
            `Bet placed successfully! Odds were updated from ${response.originalOdds} to ${response.finalOdds} before placing the bet.`, 
            "success"
          );
          // Refresh odds display to show current values
          try {
            const oddsResponse = await fetchOdds(currentPage, selectedSport);
            setOdds(oddsResponse.games || []);
          } catch (refreshError) {
            console.error('Error refreshing odds display:', refreshError);
          }
        } else {
          showNotification("Bet placed successfully!", "success");
        }
      }
    } catch (error) {
      // Auto-refresh odds for any betting error to get current data
      console.log('Betting error occurred, auto-refreshing odds:', error.message);
      
      try {
        const response = await fetchOdds(currentPage, selectedSport);
        setOdds(response.games || []);
        console.log('✅ Odds refreshed automatically after betting error');
      } catch (refreshError) {
        console.error('Error auto-refreshing odds:', refreshError);
      }
      
      // Handle different types of errors
      if (error.oddsChanged) {
        // Show confirmation dialog for odds changes
        const confirmed = confirm(
          `⚠️ ODDS CHANGED!\n\n` +
          `Original odds: ${error.originalOdds}\n` +
          `Current odds: ${error.currentOdds}\n` +
          `Difference: ${error.difference} points\n\n` +
          `Do you want to continue with the updated odds (${error.currentOdds})?`
        );
        
        if (confirmed) {
          // User confirmed, place bet with updated odds
          try {
            const confirmResponse = await fetch('http://localhost:5000/api/bets/confirm-odds', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                game: game.homeTeam + ' vs ' + game.awayTeam,
                team: selectedTeam,
                amount: parseFloat(amount),
                confirmedOdds: error.currentOdds,
                sport: game.sport,
                game_date: game.commenceTime
              })
            });

            const confirmResult = await confirmResponse.json();
            
            if (confirmResult.success) {
              showNotification(`✅ Bet placed successfully with updated odds (${confirmResult.finalOdds})!`, "success");
              
              // Update user balance and refresh
              setUser(prev => ({ ...prev, balance: confirmResult.newBalance }));
              handleRefreshBets();
              
              // Refresh odds display to show current values
              try {
                const oddsResponse = await fetchOdds(currentPage, selectedSport);
                setOdds(oddsResponse.games || []);
              } catch (refreshError) {
                console.error('Error refreshing odds display:', refreshError);
              }
              
              // Reset form
              setExpandedBets(prev => ({ ...prev, [game.id]: false }));
              setSelectedTeam(null);
              setSelectedAmount(null);
              setCustomAmount('');
            } else if (confirmResult.oddsChangedAgain) {
              showNotification("⚠️ " + confirmResult.message, "warning");
            } else {
              throw new Error(confirmResult.message);
            }
          } catch (confirmError) {
            console.error('Error confirming bet with updated odds:', confirmError);
            showNotification("Failed to place bet with updated odds: " + confirmError.message, "error");
          }
        } else {
          showNotification("Bet cancelled due to odds change.", "info");
        }
      } else if (error.message && error.message.includes('Insufficient balance')) {
        showNotification("❌ Insufficient balance for this bet.", "error");
      } else if (error.message && error.message.includes('game has already started')) {
        showNotification("⏰ Cannot place bet - this game has already started.", "warning");
      } else {
        showNotification(error.message || "Failed to place bet. Odds have been refreshed - please try again.", "error");
      }
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
    setShowLeaderboard(false); // Reset view on logout
  };

  /**
   * Handles bet sale and refreshes user data
   */
  const handleBetSold = async () => {
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
      showNotification('Failed to update user data. Please refresh the page.', 'error');
    }
  };

  /**
   * Manually refreshes games data with minimal API usage
   * Only refreshes if last refresh was more than 5 minutes ago
   */
  const handleRefreshGames = async () => {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    // Prevent too frequent refreshes
    if (lastGamesRefresh && lastGamesRefresh > fiveMinutesAgo) {
      const minutesLeft = Math.ceil((lastGamesRefresh + (5 * 60 * 1000) - now) / (60 * 1000));
      showNotification(`Please wait ${minutesLeft} more minute(s) before refreshing games to conserve API calls.`, 'warning');
      return;
    }

    setIsRefreshingGames(true);
    try {
      console.log('🔄 Manually refreshing games data...');
      const response = await fetchOdds(1, selectedSport, true); // Force refresh
      setOdds(response.games || []);
      setPagination(response.pagination);
      setCurrentPage(1);
      setLastGamesRefresh(now);
      setError(null);
      console.log('✅ Games data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing games:', error);
      setError('Failed to refresh games data');
    } finally {
      setIsRefreshingGames(false);
    }
  };

  /**
   * Refreshes betting history and auto-resolves completed games
   * Called when user manually refreshes or after significant actions
   */
  const handleRefreshBets = useCallback(async () => {
    try {
      // First resolve any completed games
      console.log('🎯 Auto-resolving completed games...');
      const result = await resolveCompletedGames();
      
      if (result.success) {
        // Update user balance if any games were resolved
        if (result.resolvedGames > 0) {
          const response = await fetch('http://localhost:5000/user', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            },
            credentials: 'include'
          });

          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
          }
        }

        // Build comprehensive status message for user transparency
        let message = result.message;
        
        if (result.resolvedGames > 0) {
          message += `\n\n✅ Settled Games:`;
          result.gameResults.forEach(game => {
            message += `\n• ${game.game}: ${game.winners} winners, ${game.losers} losses`;
          });
        }
        
        if (result.failedChecks && result.failedChecks.length > 0) {
          message += `\n\n⚠️ Could not verify (${result.failedChecks.length} games):`;
          result.failedChecks.forEach(game => {
            message += `\n• ${game.game}: ${game.reason}`;
          });
          message += `\nThese bets remain pending until API data is available.`;
        }
        
        if (result.pendingGames && result.pendingGames.length > 0) {
          message += `\n\n⏳ Still in progress (${result.pendingGames.length} games):`;
          result.pendingGames.forEach(game => {
            message += `\n• ${game.game}: ${game.status}`;
          });
        }
        
        const notificationType = result.resolvedGames > 0 ? 'success' : 
                               result.failedChecks?.length > 0 ? 'warning' : 'info';
        
        showNotification(message, notificationType);
      }
    } catch (error) {
      console.error('Error auto-resolving games:', error);
      // Continue with refresh even if auto-resolve fails
    }
    
    // Trigger betting history refresh
    setBetsRefreshTrigger(prev => prev + 1);
  }, []);

  /**
   * Handles timezone change
   * @param {string} timezone - Selected timezone
   */
  const handleTimezoneChange = async (timezone) => {
    try {
      await updateUserTimezone(timezone);
      setUser(prev => ({ ...prev, timezone }));
      // Only refresh betting history to show updated timestamps - no need to fetch new odds
      setBetsRefreshTrigger(prev => prev + 1);
      showNotification('Timezone updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating timezone:', error);
      showNotification('Failed to update timezone: ' + error.message, 'error');
    }
  };

  /**
   * Clears all betting data and resets balance
   */
  const handleClearBettingData = async () => {
    if (confirm('Clear ALL betting data and reset balance to $1000? This cannot be undone.')) {
      try {
        const response = await fetch('http://localhost:5000/api/clear-betting-data', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });
        const result = await response.json();
        if (result.success) {
          showNotification('✅ All betting data cleared!', 'success');
          handleRefreshBets();
          // Refresh user data to show new balance
          const userResponse = await fetch('http://localhost:5000/user', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          if (userResponse.ok) {
            const userData = await userResponse.json();
            setUser(userData);
          }
        } else {
          showNotification('Failed to clear data: ' + result.error, 'error');
        }
      } catch (error) {
        showNotification('Error clearing data: ' + error.message, 'error');
      }
    }
  };

  // Main render method
  return (
    <div className="app">
      {!user ? (
        // Authentication interface
        <>
          {showRegister ? (
            <div className="auth-container">
              <Register onRegisterSuccess={handleRegisterSuccess} />
              <button onClick={() => setShowRegister(false)}>
                Already have an account? Login
              </button>
            </div>
          ) : (
            <Login 
              onLogin={handleLoginSuccess} 
              onShowRegister={() => setShowRegister(true)}
            />
          )}
        </>
      ) : (
        // Main application interface
        <div className="app-container">
          {/* Header with logo and navigation */}
          <Header 
            user={user}
            onLogout={handleLogout}
            showLeaderboard={showLeaderboard}
            setShowLeaderboard={setShowLeaderboard}
            onTimezoneChange={handleTimezoneChange}
          />

          {/* Main layout with sidebar ads */}
          <MainLayout>
            {showLeaderboard ? (
              <Leaderboard />
            ) : (
              <>
                {/* Sports filter controls */}
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
                  
                  <div className="refresh-controls">
                    <button 
                      className="refresh-button games-refresh"
                      onClick={handleRefreshGames}
                      disabled={isRefreshingGames}
                    >
                      {isRefreshingGames ? '🔄 Refreshing...' : '🔄 Refresh Games'}
                    </button>

                    {lastGamesRefresh && (
                      <span className="last-refresh">
                        Last refreshed: {new Date(lastGamesRefresh).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Advertisement banner between controls and games */}
                <AdComponent placement="banner" />

                {/* Games listing */}
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
                            {(() => {
                              const userTimezone = user?.timezone || 'America/Toronto';
                              const formattedTime = formatTimeForDisplay(game.commenceTime, userTimezone);
                              return formattedTime ? formattedTime.full : 'Time unavailable';
                            })()}
                          </span>
                        </div>
                        <h3>{game.homeTeam} vs {game.awayTeam}</h3>
                        
                        {!expandedBets[game.id] ? (
                          // Show odds and bet buttons for team selection
                        <div className="odds-display">
                          {game.odds && game.odds.length > 0 && (
                              <div className="team-betting-options">
                                <button 
                                  className="team-bet-button home-team"
                                  onClick={() => {
                                    setSelectedTeam(game.homeTeam);
                                    setExpandedBets(prev => ({ ...prev, [game.id]: true }));
                                  }}
                                >
                                  <div className="team-info">
                                    <span className="team-name">{game.homeTeam}</span>
                                    <span className="odds">
                                      {(() => {
                                        // Find odds by team name instead of assuming array position
                                        const homeOdds = game.odds.find(odd => odd.name === game.homeTeam);
                                        const oddsValue = homeOdds?.price;
                                        console.log(`🏠 Home team ${game.homeTeam}: odds = ${oddsValue}, full odds array:`, game.odds);
                                        return oddsValue ? `${oddsValue > 0 ? '+' : ''}${oddsValue}` : 'N/A';
                                      })()}
                                    </span>
                                  </div>
                                </button>
                                <button 
                                  className="team-bet-button away-team"
                                  onClick={() => {
                                    setSelectedTeam(game.awayTeam);
                                    setExpandedBets(prev => ({ ...prev, [game.id]: true }));
                                  }}
                                >
                                  <div className="team-info">
                                    <span className="team-name">{game.awayTeam}</span>
                                    <span className="odds">
                                      {(() => {
                                        // Find odds by team name instead of assuming array position
                                        const awayOdds = game.odds.find(odd => odd.name === game.awayTeam);
                                        const oddsValue = awayOdds?.price;
                                        return oddsValue ? `${oddsValue > 0 ? '+' : ''}${oddsValue}` : 'N/A';
                                      })()}
                                    </span>
                                  </div>
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          // Show betting amount selection
                          <div className="betting-options">
                            <div className="selected-team">
                              <p>Betting on: <strong>{selectedTeam}</strong></p>
                              <button 
                                className="change-team-button"
                                onClick={() => {
                                  setSelectedTeam(null);
                                  setExpandedBets(prev => ({ ...prev, [game.id]: false }));
                                }}
                              >
                                Change Team
                              </button>
                            </div>
                            
                            {/* Show current odds for selected team */}
                            <div className="selected-team-odds">
                              <span className="odds-label">Current Odds:</span>
                              <span className="odds-value">
                                {(() => {
                                  const teamOdds = game.odds.find(odd => odd.name === selectedTeam);
                                  return teamOdds?.price ? formatOdds(teamOdds.price) : 'N/A';
                                })()}
                              </span>
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
                              
                              {/* Show potential winnings if amount is selected */}
                              {(selectedAmount || customAmount) && (
                                <div className="potential-winnings">
                                  {(() => {
                                    const betAmount = parseFloat(customAmount || selectedAmount);
                                    const teamOdds = game.odds.find(odd => odd.name === selectedTeam);
                                    const odds = teamOdds?.price;
                                    
                                    if (betAmount > 0 && odds) {
                                      const calculation = calculateWinnings(betAmount, odds);
                                      return (
                                        <>
                                          <div className="winnings-breakdown">
                                            <div className="bet-amount-display">
                                              <span className="label">Bet Amount:</span>
                                              <span className="value">${betAmount.toFixed(2)}</span>
                                            </div>
                                            <div className="potential-profit">
                                              <span className="label">Potential Winnings:</span>
                                              <span className="value profit">{calculation.formattedWinnings}</span>
                                            </div>
                                            <div className="total-payout">
                                              <span className="label">Total if Wins:</span>
                                              <span className="value total">{calculation.formattedTotalPayout}</span>
                                            </div>
                                          </div>
                                        </>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              )}
                              
                            <div className="bet-actions">
                              <button 
                                className="confirm-bet-button"
                                disabled={!selectedTeam || (!selectedAmount && !customAmount)}
                                onClick={() => {
                                  // Find odds by team name instead of assuming array position
                                  const teamOdds = game.odds.find(odd => odd.name === selectedTeam);
                                  const selectedOdds = teamOdds?.price;
                                  
                                  if (!selectedOdds) {
                                    showNotification("Unable to find odds for selected team", "error");
                                    return;
                                  }
                                  
                                  handlePlaceBet(game, customAmount || selectedAmount, selectedTeam, selectedOdds);
                                }}
                              >
                                Confirm Bet
                              </button>
                              <button 
                                className="cancel-bet-button"
                                onClick={() => {
                                  setExpandedBets(prev => ({ ...prev, [game.id]: false }));
                                  setSelectedTeam(null);
                                  setSelectedAmount(null);
                                  setCustomAmount('');
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                            </div>
                          )}
                      </div>
                    ))
                  )}
                </div>

                {/* Load more button */}
                {!isLoading && pagination?.hasMore && (
                  <button onClick={handleLoadMore} className="load-more-button">
                    Load More Games
                  </button>
                )}

                {/* Advertisement banner between games and betting panel */}
                <AdComponent placement="banner" />

                {/* Betting panel with active bets and history */}
                <BettingPanel 
                  userId={user.id} 
                  refreshTrigger={betsRefreshTrigger}
                  onBetSold={handleBetSold}
                  onRefreshBets={handleRefreshBets}
                  onClearData={handleClearBettingData}
                  userTimezone={user?.timezone || 'America/Toronto'}
                />
              </>
            )}
          </MainLayout>
        </div>
      )}

      {/* Global Notification Component */}
      <Notification
        message={notification.message}
        type={notification.type}
        isVisible={notification.visible}
        onClose={closeNotification}
      />
    </div>
  );
}

export default App;
