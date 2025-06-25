/**
 * Odds Change Modal Component
 * 
 * Displays a confirmation modal when odds have changed between team selection
 * and bet confirmation, allowing the user to accept updated odds or cancel.
 * 
 * @param {boolean} isVisible - Whether the modal is visible
 * @param {string} message - The odds change message from the server
 * @param {number} originalOdds - The original odds when user selected team
 * @param {number} currentOdds - The current updated odds
 * @param {number} difference - The difference between original and current odds
 * @param {Function} onConfirm - Callback when user confirms with updated odds
 * @param {Function} onCancel - Callback when user cancels the bet
 * @param {boolean} isLoading - Whether the confirmation is in progress
 */

import './OddsChangeModal.css';

function OddsChangeModal({ 
  isVisible, 
  message, 
  originalOdds, 
  currentOdds, 
  difference, 
  onConfirm, 
  onCancel, 
  isLoading 
}) {
  if (!isVisible) return null;

  const oddsIncreased = currentOdds > originalOdds;
  const changeType = oddsIncreased ? 'increased' : 'decreased';
  const changeClass = oddsIncreased ? 'odds-better' : 'odds-worse';

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="odds-change-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>⚠️ Odds Have Changed</h3>
          <button className="modal-close" onClick={onCancel} disabled={isLoading}>
            ×
          </button>
        </div>
        
        <div className="modal-content">
          <div className="odds-change-notice">
            <p className="change-message">{message}</p>
          </div>

          <div className="odds-comparison">
            <div className="odds-row">
              <span className="odds-label">Original Odds:</span>
              <span className="odds-value original">{originalOdds > 0 ? '+' : ''}{originalOdds}</span>
            </div>
            <div className="odds-arrow">↓</div>
            <div className="odds-row">
              <span className="odds-label">Current Odds:</span>
              <span className={`odds-value current ${changeClass}`}>
                {currentOdds > 0 ? '+' : ''}{currentOdds}
              </span>
            </div>
            
            <div className="odds-difference">
              <span className={`difference-text ${changeClass}`}>
                Odds have {changeType} by {Math.abs(difference)} points
              </span>
              {oddsIncreased && (
                <span className="odds-impact positive">
                  ✅ Better payout potential
                </span>
              )}
              {!oddsIncreased && (
                <span className="odds-impact negative">
                  ⚠️ Lower payout potential
                </span>
              )}
            </div>
          </div>

          <div className="confirmation-question">
            <p>Do you want to place your bet with the updated odds?</p>
          </div>
        </div>

        <div className="modal-actions">
          <button 
            className="cancel-button" 
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel Bet
          </button>
          <button 
            className="confirm-button" 
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Placing Bet...' : `Confirm with ${currentOdds > 0 ? '+' : ''}${currentOdds}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OddsChangeModal; 