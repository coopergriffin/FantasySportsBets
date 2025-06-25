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
    let date;
    
    // Handle different timestamp formats
    if (typeof utcTimestamp === 'string') {
      // Check if it's already a UTC string (ends with Z or +00:00)
      if (utcTimestamp.endsWith('Z') || utcTimestamp.includes('+00:00') || utcTimestamp.includes('-00:00')) {
        date = new Date(utcTimestamp);
      } else {
        // If it's a plain datetime string, treat it as UTC
        date = new Date(utcTimestamp + (utcTimestamp.includes('T') ? '' : 'T00:00:00') + 'Z');
      }
    } else {
      date = new Date(utcTimestamp);
    }
    
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
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    
    const formattedDate = date.toLocaleDateString('en-US', dateOptions);
    const formattedTime = date.toLocaleTimeString('en-US', timeOptions);
    
    // Extract timezone abbreviation more reliably
    const timezoneParts = timezone.split('/');
    const shortTimezone = timezoneParts[timezoneParts.length - 1] || timezone;
    
    // Get the actual timezone abbreviation if possible
    const timezoneFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    });
    
    let actualTimezone = shortTimezone;
    try {
      const timezonePart = timezoneFormatter.formatToParts(date).find(part => part.type === 'timeZoneName');
      if (timezonePart) {
        actualTimezone = timezonePart.value;
      }
    } catch (e) {
      // Fallback to simple extraction
    }
    
    return {
      date: formattedDate,
      time: formattedTime,
<<<<<<< HEAD
      timezone: shortTimezone,
      full: `${formattedDate} at ${formattedTime} ${shortTimezone}`
=======
      timezone: actualTimezone,
      full: `${formattedDate} at ${formattedTime} (${actualTimezone})`
>>>>>>> 92c22fc40e42fe6c8c610c3fe838c123c61284a0
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