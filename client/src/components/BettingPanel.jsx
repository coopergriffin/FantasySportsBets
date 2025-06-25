/**
 * BettingPanel Component
 * 
 * Displays active bets on the left and betting history on the right side-by-side.
 * Uses the same styling as the original BettingHistory component for consistency.
 * 
 * @param {number} userId - The ID of the user whose bets to display
 * @param {number} refreshTrigger - Counter that triggers data refresh when incremented
 * @param {Function} onBetSold - Callback function called when a bet is sold
 * @param {Function} onRefreshBets - Callback function to refresh betting history and resolve completed games
 */

import { useState, useEffect } from 'react';
import SellBetModal from './SellBetModal';
import Notification from './Notification';
import { getSellQuote } from '../api';
import { formatTimeForDisplay } from '../utils/timeUtils';
import './BettingPanel.css';

function BettingPanel({ userId, refreshTrigger, onBetSold, onRefreshBets, onClearData, userTimezone = 'America/Toronto' }) {
  // Component state
  const [allBets, setAllBets] = useState([]); // Array of all user's bets
  const [activeBets, setActiveBets] = useState([]); // Array of pending bets
  const [resolvedBets, setResolvedBets] = useState([]); // Array of resolved bets (won/lost/sold)
  const [loading, setLoading] = useState(true); // Loading state indicator
  const [error, setError] = useState(null); // Error message state
  
  // Modal and notification state
  const [sellModalVisible, setSellModalVisible] = useState(false);
  const [sellModalData, setSellModalData] = useState(null);
  const [sellLoading, setSellLoading] = useState(false);
  const [notification, setNotification] = useState({ visible: false, message: '', type: 'info' });

  /**
   * Effect hook to load betting history when userId or refreshTrigger changes
   * Separates bets into active and resolved categories
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
        setAllBets(data);
        
        // Separate bets into active and resolved
        const active = data.filter(bet => {
          const status = bet.status || bet.outcome || 'pending';
          return status === 'pending';
        });
        
        const resolved = data.filter(bet => {
          const status = bet.status || bet.outcome || 'pending';
          return status !== 'pending';
        });
        
        setActiveBets(active);
        setResolvedBets(resolved);
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
   * Handles opening sell bet modal
   * Gets sell quote from backend and displays confirmation modal
   * 
   * @param {number} betId - The ID of the bet to sell
   */
  const handleOpenSellModal = async (betId) => {
    try {
      const quote = await getSellQuote(betId);
      setSellModalData({
        bet: quote.bet,
        sellValue: quote.quote.sellValue,
        profitLoss: quote.quote.profitLoss,
        currentOdds: quote.quote.currentOdds
      });
      setSellModalVisible(true);
    } catch (error) {
      console.error('Error getting sell quote:', error);
      showNotification('Failed to get sell quote: ' + error.message, 'error');
    }
  };

  /**
   * Handles confirmed bet sale
   * Calls backend API to sell bet and triggers parent component refresh
   */
  const handleConfirmSell = async () => {
    if (!sellModalData) return;
    
    try {
      setSellLoading(true);
      const token = localStorage.getItem('token');
      
      // Call backend API to sell the bet
      const response = await fetch(`http://localhost:5000/sell-bet/${sellModalData.bet.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Handle API errors
      if (!response.ok) {
        let errorMessage = 'Failed to sell bet';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      // Validate response structure
      if (!result.success) {
        throw new Error(result.error || result.message || 'Sell operation failed');
      }
      
      // Close modal and show success notification
      setSellModalVisible(false);
      setSellModalData(null);
      
      // Show detailed success message with profit/loss information
      const profitLoss = result.profitLoss || 0;
      let message = `Bet sold for $${result.sellValue}! `;
      
      if (profitLoss > 0) {
        message += `Profit: +$${profitLoss.toFixed(2)} 📈`;
      } else if (profitLoss < 0) {
        message += `Loss: $${Math.abs(profitLoss).toFixed(2)} 📉`;
      } else {
        message += `No change in value`;
      }
      
      showNotification(message, profitLoss >= 0 ? 'success' : 'warning');
      
      // Notify parent component of successful sale
      onBetSold();
    } catch (error) {
      console.error('Error selling bet:', error);
      showNotification('Failed to sell bet: ' + error.message, 'error');
    } finally {
      setSellLoading(false);
    }
  };

  /**
   * Handles canceling sell bet modal
   */
  const handleCancelSell = () => {
    setSellModalVisible(false);
    setSellModalData(null);
    setSellLoading(false);
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

  /**
   * Renders a single bet item with consistent styling
   * @param {Object} bet - The bet object to render
   * @param {boolean} isActive - Whether this is an active bet (shows sell button)
   */
  const renderBetItem = (bet, isActive = false) => {
    const betStatus = bet.status || bet.outcome || 'pending';
    const isPending = betStatus === 'pending';
    const canSell = isActive && isPending && bet.game_date && canSellBet(bet.game_date);
    
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
            {bet.game_date && (
              <span className="bet-date">
                Game: {(() => {
                  const formatted = formatTimeForDisplay(bet.game_date, userTimezone);
                  return formatted ? `${formatted.date} at ${formatted.time} ${formatted.timezone}` : 'Time unavailable';
                })()}
              </span>
            )}
            <span className="bet-created">
              Placed: {(() => {
                if (bet.created_at_formatted) {
                  return `${bet.created_at_formatted.date} at ${bet.created_at_formatted.time} (${bet.created_at_formatted.timezone})`;
                } else {
                  const formatted = formatTimeForDisplay(bet.created_at, userTimezone);
                  return formatted ? `${formatted.date} at ${formatted.time} (${formatted.timezone})` : 'Unknown time';
                }
              })()}
            </span>
            {bet.status_changed_at && !isPending && (
              <span className="bet-status-changed">
                {betStatus.charAt(0).toUpperCase() + betStatus.slice(1)}: {(() => {
                  const formatted = formatTimeForDisplay(bet.status_changed_at, userTimezone);
                  return formatted ? `${formatted.date} at ${formatted.time} (${formatted.timezone})` : 'Unknown time';
                })()}
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
            onClick={() => handleOpenSellModal(bet.id)}
          >
            Sell Bet
          </button>
        )}
        
        {/* Show message if bet can't be sold because game started */}
        {isActive && isPending && bet.game_date && !canSellBet(bet.game_date) && (
          <span className="game-started-message">Game has started</span>
        )}
      </div>
    );
  };

  // Loading state render
  if (loading) {
    return <div className="betting-panel loading">Loading betting data...</div>;
  }

  // Error state render
  if (error) {
    return <div className="betting-panel error">Error: {error}</div>;
  }

  // Main component render
  return (
    <div className="betting-panel">
      <div className="betting-panel-container">
        {/* Active Bets Column */}
        <div className="betting-section active-bets">
          <div className="betting-history-header">
            <h2>Active Bets ({activeBets.length})</h2>
            <div className="betting-header-buttons">
              <button 
                className="refresh-button bets-refresh"
                onClick={onRefreshBets}
              >
                📈 Refresh & Resolve Games
              </button>
              {onClearData && (
                <button 
                  className="refresh-button clear-data-button"
                  onClick={onClearData}
                  style={{ backgroundColor: '#ff4444', marginLeft: '10px' }}
                >
                  🗑️ Clear All Data
                </button>
              )}
            </div>
          </div>
          <div className="bets-list">
            {activeBets.length === 0 ? (
              <div className="betting-history-empty">No active bets.</div>
            ) : (
              activeBets.map((bet) => renderBetItem(bet, true))
            )}
          </div>
        </div>

        {/* Betting History Column */}
        <div className="betting-section betting-history">
          <div className="betting-history-header">
            <h2>Betting History ({resolvedBets.length})</h2>
          </div>
          <div className="bets-list">
            {resolvedBets.length === 0 ? (
              <div className="betting-history-empty">No betting history yet.</div>
            ) : (
              resolvedBets.map((bet) => renderBetItem(bet, false))
            )}
          </div>
        </div>
      </div>

      {/* Sell Bet Confirmation Modal */}
      <SellBetModal
        bet={sellModalData?.bet}
        sellValue={sellModalData?.sellValue}
        profitLoss={sellModalData?.profitLoss}
        currentOdds={sellModalData?.currentOdds}
        isVisible={sellModalVisible}
        onConfirm={handleConfirmSell}
        onCancel={handleCancelSell}
        isLoading={sellLoading}
      />

      {/* Notification Component */}
      <Notification
        message={notification.message}
        type={notification.type}
        isVisible={notification.visible}
        onClose={closeNotification}
      />
    </div>
  );
}

export default BettingPanel; 