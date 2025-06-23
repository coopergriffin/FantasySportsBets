/**
 * Leaderboard Component
 * 
 * Displays a global leaderboard of all users ranked by their current balance.
 * Fetches real-time data from the backend API and displays it in a table format.
 */

import { useState, useEffect } from 'react';
import './Leaderboard.css';

function Leaderboard() {
    // Component state
    const [users, setUsers] = useState([]); // Array of users with balance data
    const [loading, setLoading] = useState(true); // Loading state indicator
    const [error, setError] = useState(null); // Error message state

    /**
     * Effect hook to fetch leaderboard data when component mounts
     * Handles authentication and error states gracefully
     */
    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                setLoading(true);
                
                // Fetch leaderboard data from backend API
                const response = await fetch('http://localhost:5000/leaderboard', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });

                // Handle API errors
                if (!response.ok) {
                    throw new Error('Failed to fetch leaderboard');
                }

                // Update state with fetched user rankings
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
    }, []); // Empty dependency array - only run on component mount

    // Loading state render
    if (loading) {
        return <div className="leaderboard-loading">Loading leaderboard...</div>;
    }

    // Error state render
    if (error) {
        return <div className="leaderboard-error">Error: {error}</div>;
    }

    // Main component render
    return (
        <div className="leaderboard-container">
            <h2>Leaderboard</h2>
            
            {/* Leaderboard table structure */}
            <div className="leaderboard-table">
                {/* Table header */}
                <div className="leaderboard-header">
                    <div className="rank">Rank</div>
                    <div className="username">Username</div>
                    <div className="balance">Balance</div>
                </div>
                
                {/* User rows - rankings based on array index */}
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