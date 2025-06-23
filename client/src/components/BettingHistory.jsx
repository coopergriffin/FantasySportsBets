import { useState, useEffect } from 'react';
import './BettingHistory.css';

function BettingHistory({ userId, refreshTrigger, onBetCancelled }) {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadBets = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        
        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await fetch(`http://localhost:5000/bets/${userId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load betting history');
        }

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
  }, [userId, refreshTrigger]);

  const handleCancelBet = async (betId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/bets/${betId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel bet');
      }

      onBetCancelled();
    } catch (error) {
      console.error('Error cancelling bet:', error);
      alert(error.message);
    }
  };

  const canCancelBet = (gameDate) => {
    return new Date(gameDate) > new Date();
  };

  if (loading) {
    return <div className="betting-history loading">Loading betting history...</div>;
  }

  if (error) {
    return <div className="betting-history error">Error: {error}</div>;
  }

  if (!bets.length) {
    return <div className="betting-history empty">No bets placed yet.</div>;
  }

  return (
    <div className="betting-history">
      <h2>Betting History</h2>
      <div className="bets-list">
        {bets.map((bet) => (
          <div key={bet.id} className={`bet-item ${bet.outcome}`}>
            <div className="bet-details">
              <span className="game">{bet.game}</span>
              <span className="amount">${bet.amount}</span>
              <span className="odds">{bet.odds > 0 ? '+' : ''}{bet.odds}</span>
              <span className="outcome">{bet.outcome}</span>
            </div>
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