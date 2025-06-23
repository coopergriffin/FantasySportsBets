import { useState, useEffect } from 'react';
import './Leaderboard.css';

function Leaderboard() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                setLoading(true);
                const response = await fetch('http://localhost:5000/leaderboard', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch leaderboard');
                }

                const data = await response.json();
                setUsers(data.users);
                setError(null);
            } catch (err) {
                console.error('Error fetching leaderboard:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, []);

    if (loading) {
        return <div className="leaderboard-loading">Loading leaderboard...</div>;
    }

    if (error) {
        return <div className="leaderboard-error">Error: {error}</div>;
    }

    return (
        <div className="leaderboard-container">
            <h2>Leaderboard</h2>
            <div className="leaderboard-table">
                <div className="leaderboard-header">
                    <div className="rank">Rank</div>
                    <div className="username">Username</div>
                    <div className="balance">Balance</div>
                </div>
                {users.map((user, index) => (
                    <div key={user.id} className="leaderboard-row">
                        <div className="rank">{index + 1}</div>
                        <div className="username">{user.username}</div>
                        <div className="balance">${user.balance}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Leaderboard; 