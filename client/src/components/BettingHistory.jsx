/**
 * BettingHistory Component
 * 
 * Displays a user's betting history with the ability to cancel pending bets.
 * Automatically refreshes when new bets are placed or cancelled.
 * 
 * @param {number} userId - The ID of the user whose bets to display
 * @param {number} refreshTrigger - Counter that triggers data refresh when incremented
 * @param {Function} onBetCancelled - Callback function called when a bet is cancelled
 */

import { useState, useEffect } from 'react';
import './BettingHistory.css';

function BettingHistory({ userId, refreshTrigger, onBetCancelled }) {
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
   * Handles bet cancellation
   * Calls backend API to cancel bet and triggers parent component refresh
   * 
   * @param {number} betId - The ID of the bet to cancel
   */
  const handleCancelBet = async (betId) => {
    try {
      const token = localStorage.getItem('token');
      
      // Call backend API to cancel the bet
      const response = await fetch(`http://localhost:5000/bets/${betId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Handle API errors
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel bet');
      }

      // Notify parent component of successful cancellation
      onBetCancelled();
    } catch (error) {
      console.error('Error cancelling bet:', error);
      alert(error.message);
    }
  };

  /**
   * Determines if a bet can be cancelled based on game date
   * Bets can only be cancelled before the game starts
   * 
   * @param {string} gameDate - ISO date string of the game
   * @returns {boolean} True if bet can be cancelled, false otherwise
   */
  const canCancelBet = (gameDate) => {
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
      <h2>Betting History</h2>
      <div className="bets-list">
        {bets.map((bet) => (
          <div key={bet.id} className={`bet-item ${bet.outcome}`}>
            {/* Bet information display */}
            <div className="bet-details">
              <span className="game">{bet.game}</span>
              <span className="amount">${bet.amount}</span>
              <span className="odds">{bet.odds > 0 ? '+' : ''}{bet.odds}</span>
              <span className="outcome">{bet.outcome}</span>
            </div>
            
            {/* Cancel button for pending bets */}
            {bet.outcome === 'pending' && (
              <button onClick={() => handleCancelBet(bet.id)}>Cancel Bet</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default BettingHistory; 