/**
 * BettingHistory Component
 * 
 * Displays a user's betting history with the ability to sell pending bets.
 * Automatically refreshes when new bets are placed or sold.
 * 
 * @param {number} userId - The ID of the user whose bets to display
 * @param {number} refreshTrigger - Counter that triggers data refresh when incremented
 * @param {Function} onBetSold - Callback function called when a bet is sold
 * @param {Function} onRefreshBets - Callback function to refresh betting history and resolve completed games
 */

import { useState, useEffect } from 'react';
import { formatTimeForDisplay } from '../utils/timeUtils';
import './BettingHistory.css';

function BettingHistory({ userId, refreshTrigger, onBetSold, onRefreshBets, userTimezone = 'America/Toronto' }) {
  // Component state
  const [bets, setBets] = useState([]); // Array of user's betting history
  const [loading, setLoading] = useState(true); // Loading state indicator
  const [error, setError] = useState(null); // Error message state

  /**
   * Effect hook to load betting history when userId or refreshTrigger changes
   * Handles authentication and error states gracefully
   */
  useEffect(() => {
    const loadBets = async () => {
      // Don't load if no user is provided
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Get authentication token from localStorage
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No authentication token found');
        }

        // Fetch betting history from backend
        const response = await fetch(`http://localhost:5000/bets/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        // Handle API errors
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load betting history');
        }

        // Update state with fetched data
        const data = await response.json();
        setBets(data);
        setLoading(false);
      } catch (error) {
        console.error('Error loading bets:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    loadBets();
  }, [userId, refreshTrigger]); // Dependencies: re-run when userId or refreshTrigger changes

  /**
   * Handles bet sale
   * Calls backend API to sell bet and triggers parent component refresh
   * 
   * @param {number} betId - The ID of the bet to sell
   */
  const handleSellBet = async (betId) => {
    try {
      const token = localStorage.getItem('token');
      
      // Call backend API to sell the bet
      const response = await fetch(`http://localhost:5000/sell-bet/${betId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Handle API errors
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sell bet');
      }

      const result = await response.json();
      
      // Show detailed success message with profit/loss information
      let message = `Bet sold successfully!\n`;
      message += `Original Amount: $${result.originalAmount}\n`;
      message += `Sale Value: $${result.sellValue}\n`;
      
      if (result.profitLoss > 0) {
        message += `Profit: +$${result.profitLoss.toFixed(2)} 📈\n`;
      } else if (result.profitLoss < 0) {
        message += `Loss: $${result.profitLoss.toFixed(2)} 📉\n`;
      } else {
        message += `No change in value\n`;
      }
      
      if (result.currentOdds && result.originalOdds !== result.currentOdds) {
        message += `Odds: ${result.originalOdds} → ${result.currentOdds}`;
      }
      
      alert(message);
      
      // Notify parent component of successful sale
      onBetSold();
    } catch (error) {
      console.error('Error selling bet:', error);
      alert(error.message);
    }
  };

  /**
   * Determines if a bet can be sold based on game date
   * Bets can only be sold before the game starts
   * 
   * @param {string} gameDate - ISO date string of the game
   * @returns {boolean} True if bet can be sold, false otherwise
   */
  const canSellBet = (gameDate) => {
    return new Date(gameDate) > new Date();
  };

  // Loading state render
  if (loading) {
    return <div className="betting-history loading">Loading betting history...</div>;
  }

  // Error state render
  if (error) {
    return <div className="betting-history error">Error: {error}</div>;
  }

  // Empty state render
  if (!bets.length) {
    return <div className="betting-history empty">No bets placed yet.</div>;
  }

  // Main component render
  return (
    <div className="betting-history">
      <div className="betting-history-header">
        <h2>Betting History</h2>
        <button 
          className="refresh-button bets-refresh"
          onClick={onRefreshBets}
        >
          📈 Refresh & Resolve Games
        </button>
      </div>
      <div className="bets-list">
        {bets.map((bet) => {
          const betStatus = bet.status || bet.outcome || 'pending';
          const isPending = betStatus === 'pending';
          const canSell = isPending && bet.game_date && canSellBet(bet.game_date);
          
          return (
            <div key={bet.id} className={`bet-item ${betStatus}`}>
              {/* Bet information display */}
              <div className="bet-details">
                <div className="bet-game">{bet.game}</div>
                <div className="bet-info">
                  <span className="bet-amount">${bet.amount}</span>
                  <span className="bet-odds">{bet.odds > 0 ? '+' : ''}{bet.odds}</span>
                  <span className={`bet-status status-${betStatus}`}>
                    {betStatus.charAt(0).toUpperCase() + betStatus.slice(1)}
                  </span>
                  {bet.team && (
                    <span className="bet-team">Team: {bet.team}</span>
                  )}
                  {bet.game_date_formatted && (
                    <span className="bet-date">
                      Game: {bet.game_date_formatted.date} at {bet.game_date_formatted.time} ({bet.game_date_formatted.timezone})
                    </span>
                  )}
                  <span className="bet-created">
                    Placed: {(() => {
                      if (bet.created_at_formatted) {
                        return `${bet.created_at_formatted.date} at ${bet.created_at_formatted.time}`;
                      } else {
                        const formatted = formatTimeForDisplay(bet.created_at, userTimezone);
                        return formatted ? `${formatted.date} at ${formatted.time}` : 'Unknown time';
                      }
                    })()}
                  </span>
                  {bet.status_changed_at_formatted && !isPending && (
                    <span className="bet-status-changed">
                      {betStatus.charAt(0).toUpperCase() + betStatus.slice(1)}: {bet.status_changed_at_formatted.date} at {bet.status_changed_at_formatted.time}
                    </span>
                  )}
                  {!isPending && bet.final_amount !== null && bet.profit_loss !== null && (
                    <div className="bet-financial-details">
                      <span className="bet-original">Original: ${bet.amount}</span>
                      <span className="bet-final">Final: ${bet.final_amount}</span>
                      <span className={`bet-profit-loss ${bet.profit_loss >= 0 ? 'profit' : 'loss'}`}>
                        {bet.profit_loss >= 0 ? '+' : ''}${bet.profit_loss} 
                        {bet.profit_loss >= 0 ? ' 📈' : ' 📉'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Sell button for pending bets that haven't started */}
              {canSell && (
                <button 
                  className="sell-bet-button"
                  onClick={() => handleSellBet(bet.id)}
                >
                  Sell Bet
                </button>
              )}
              
              {/* Show message if bet can't be sold because game started */}
              {isPending && bet.game_date && !canSellBet(bet.game_date) && (
                <span className="game-started-message">Game has started</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default BettingHistory; 