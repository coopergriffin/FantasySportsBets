/**
 * Notification Component
 * 
 * Displays toast-style notifications to replace browser alerts.
 * Supports different types (success, error, warning, info) and auto-dismissal.
 * 
 * @param {string} message - The notification message to display
 * @param {string} type - Type of notification ('success', 'error', 'warning', 'info')
 * @param {boolean} isVisible - Whether the notification is visible
 * @param {Function} onClose - Callback function when notification is closed
 * @param {number} autoClose - Auto-close delay in milliseconds (0 = no auto-close)
 */

import { useEffect } from 'react';
import './Notification.css';

function Notification({ message, type = 'info', isVisible, onClose, autoClose = 3000 }) {
  // Auto-close functionality
  useEffect(() => {
    if (isVisible && autoClose > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, autoClose);

      return () => clearTimeout(timer);
    }
  }, [isVisible, autoClose, onClose]);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  return (
    <div className={`notification notification-${type} ${isVisible ? 'notification-visible' : ''}`}>
      <div className="notification-content">
        <span className="notification-icon">{getIcon()}</span>
        <span className="notification-message">{message}</span>
        <button 
          className="notification-close" 
          onClick={onClose}
          aria-label="Close notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default Notification; 