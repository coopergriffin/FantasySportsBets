/**
 * Sell Bet Modal Component
 * 
 * Displays a confirmation modal when selling a bet, showing the sell price,
 * profit/loss, and allowing the user to confirm or cancel the transaction.
 * 
 * @param {Object} bet - The bet object being sold
 * @param {number} sellValue - The calculated sell value
 * @param {number} profitLoss - The profit or loss amount
 * @param {number} currentOdds - Current odds for the bet
 * @param {boolean} isVisible - Whether the modal is visible
 * @param {Function} onConfirm - Callback when user confirms the sale
 * @param {Function} onCancel - Callback when user cancels the sale
 * @param {boolean} isLoading - Whether the sell operation is in progress
 */

import './SellBetModal.css';

function SellBetModal({ bet, sellValue, profitLoss, currentOdds, isVisible, onConfirm, onCancel, isLoading }) {
  if (!isVisible || !bet) return null;

  const isProfitable = profitLoss > 0;
  const profitLossPercent = ((profitLoss / bet.amount) * 100).toFixed(1);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="sell-bet-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🔄 Sell Bet</h3>
          <button className="modal-close" onClick={onCancel} disabled={isLoading}>
            ×
          </button>
        </div>
        
        <div className="modal-content">
          <div className="bet-summary">
            <div className="bet-game-title">{bet.game}</div>
            <div className="bet-team-info">
              <span className="bet-team">Team: {bet.team}</span>
              <span className="bet-original-amount">Original Bet: ${bet.amount}</span>
            </div>
          </div>

          <div className="odds-comparison">
            <div className="odds-row">
              <span className="odds-label">Original Odds:</span>
              <span className="odds-value">{bet.odds > 0 ? '+' : ''}{bet.odds}</span>
            </div>
            <div className="odds-row">
              <span className="odds-label">Current Odds:</span>
              <span className="odds-value">{currentOdds > 0 ? '+' : ''}{currentOdds}</span>
            </div>
          </div>

          <div className="sell-details">
            <div className="sell-value-row">
              <span className="sell-label">You will receive:</span>
              <span className="sell-value">${sellValue.toFixed(2)}</span>
            </div>
            
            <div className={`profit-loss-row ${isProfitable ? 'profit' : 'loss'}`}>
              <span className="profit-loss-label">
                {isProfitable ? 'Profit:' : 'Loss:'}
              </span>
              <span className="profit-loss-value">
                {isProfitable ? '+' : ''}${profitLoss.toFixed(2)} ({profitLossPercent}%)
              </span>
            </div>
          </div>

          <div className="modal-actions">
            <button 
              className="cancel-button" 
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button 
              className="confirm-button" 
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? 'Selling...' : `Sell for $${sellValue.toFixed(2)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SellBetModal; 