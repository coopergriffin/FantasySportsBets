/**
 * Header Component - Professional navigation and branding
 * 
 * Displays the FantasyBets logo, user information, and global controls.
 * Includes timezone selector for international users and navigation toggles.
 * Features responsive design and header advertisement placement.
 * 
 * @param {Object} user - Current user object with balance and username
 * @param {Function} onLogout - Logout handler function
 * @param {boolean} showLeaderboard - Current leaderboard view state
 * @param {Function} setShowLeaderboard - Toggle leaderboard visibility
 * @param {Function} onTimezoneChange - Handle timezone selection changes
 */

import './Header.css';

function Header({ user, onLogout, showLeaderboard, setShowLeaderboard, onTimezoneChange }) {
  return (
    <header className="app-header">
      <div className="header-content">
        {/* Logo Section */}
        <div className="logo-section">
          <div className="logo-placeholder">
            <div className="logo-icon">⚡</div>
            <div className="logo-text">
              <h1>FantasyBets</h1>
              <span className="logo-tagline">Smart Sports Betting</span>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="header-nav">
          <div className="user-info">
            <span className="welcome-text">Welcome, {user.username}!</span>
            <span className="balance">Balance: ${user.balance.toFixed(2)}</span>
          </div>

          {/* Timezone Selector */}
          <div className="timezone-selector">
            <label htmlFor="timezone">Timezone: </label>
            <select 
              id="timezone" 
              value={user.timezone || 'America/Toronto'} 
              onChange={(e) => onTimezoneChange(e.target.value)}
            >
              {/* Canadian Timezones - Ordered by UTC offset */}
              <optgroup label="🇨🇦 Canada">
                <option value="America/St_Johns">St. John's - UTC-3:30</option>
                <option value="America/Halifax">Halifax - UTC-4</option>
                <option value="America/Toronto">Toronto - UTC-5</option>
                <option value="America/Winnipeg">Winnipeg - UTC-6</option>
                <option value="America/Edmonton">Edmonton - UTC-7</option>
                <option value="America/Vancouver">Vancouver - UTC-8</option>
              </optgroup>
              
              {/* US Major Cities - Ordered by UTC offset */}
              <optgroup label="🇺🇸 United States">
                <option value="Pacific/Honolulu">Honolulu - UTC-10</option>
                <option value="America/Anchorage">Anchorage - UTC-9</option>
                <option value="America/Los_Angeles">Los Angeles - UTC-8</option>
                <option value="America/Phoenix">Phoenix - UTC-7</option>
                <option value="America/Denver">Denver - UTC-7</option>
                <option value="America/Chicago">Chicago - UTC-6</option>
                <option value="America/New_York">New York - UTC-5</option>
              </optgroup>
              
              {/* International Major Cities - Ordered by UTC offset */}
              <optgroup label="🌍 International">
                <option value="Pacific/Auckland">Auckland - UTC+12</option>
                <option value="Australia/Sydney">Sydney - UTC+10</option>
                <option value="Asia/Tokyo">Tokyo - UTC+9</option>
                <option value="Asia/Shanghai">Shanghai - UTC+8</option>
                <option value="Asia/Bangkok">Bangkok - UTC+7</option>
                <option value="Asia/Dhaka">Dhaka - UTC+6</option>
                <option value="Asia/Kolkata">Mumbai - UTC+5:30</option>
                <option value="Asia/Karachi">Karachi - UTC+5</option>
                <option value="Asia/Dubai">Dubai - UTC+4</option>
                <option value="Europe/Moscow">Moscow - UTC+3</option>
                <option value="Africa/Cairo">Cairo - UTC+2</option>
                <option value="Europe/Paris">Paris - UTC+1</option>
                <option value="Europe/London">London - UTC+0</option>
                <option value="UTC">UTC (Universal Time)</option>
                <option value="Atlantic/Azores">Azores - UTC-1</option>
                <option value="America/Sao_Paulo">São Paulo - UTC-3</option>
                <option value="America/Argentina/Buenos_Aires">Buenos Aires - UTC-3</option>
              </optgroup>
            </select>
          </div>
          
          <div className="nav-buttons">
            <button 
              className="nav-button"
              onClick={() => setShowLeaderboard(!showLeaderboard)}
            >
              {showLeaderboard ? '🎮 Show Games' : '🏆 Leaderboard'}
            </button>
            <button className="nav-button logout" onClick={onLogout}>
              🚪 Logout
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}

export default Header; 