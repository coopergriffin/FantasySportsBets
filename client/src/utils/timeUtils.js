/**
 * Time formatting utilities for consistent timezone display
 */

/**
 * Formats a UTC timestamp for display in user's timezone
 * @param {string|Date} utcTimestamp - UTC timestamp
 * @param {string} timezone - User's timezone (e.g., 'America/Toronto')
 * @returns {Object} Formatted time information
 */
export const formatTimeForDisplay = (utcTimestamp, timezone = 'America/Toronto') => {
  if (!utcTimestamp) return null;
  
  try {
    const date = new Date(utcTimestamp);
    
    if (isNaN(date.getTime())) {
      return { date: 'Invalid Date', time: 'Invalid Time', timezone };
    }
    
    const dateOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    };
    
    const timeOptions = {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };
    
    const formattedDate = date.toLocaleDateString('en-US', dateOptions);
    const formattedTime = date.toLocaleTimeString('en-US', timeOptions);
    const shortTimezone = timezone.split('/')[1] || timezone;
    
    return {
      date: formattedDate,
      time: formattedTime,
      timezone: shortTimezone,
      full: `${formattedDate} at ${formattedTime} (${shortTimezone})`
    };
  } catch (error) {
    console.error('Error formatting time:', error);
    return { date: 'Invalid Date', time: 'Invalid Time', timezone };
  }
};

/**
 * Hook to get consistent time formatting function
 * @param {string} timezone - Current user timezone
 * @returns {Function} Format function that uses current timezone
 */
export const useTimeFormatter = (timezone) => {
  return (utcTimestamp) => formatTimeForDisplay(utcTimestamp, timezone);
}; 