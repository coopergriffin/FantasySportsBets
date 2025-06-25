/**
 * Utility functions for odds calculations and betting mathematics
 */

/**
 * Calculate potential winnings from American odds
 * @param {number} betAmount - The amount being bet
 * @param {number} odds - American odds (e.g., +150, -110)
 * @returns {Object} Object containing potential winnings, total payout, and formatted strings
 */
export function calculateWinnings(betAmount, odds) {
  if (!betAmount || !odds || betAmount <= 0) {
    return {
      winnings: 0,
      totalPayout: betAmount || 0,
      formattedWinnings: '$0.00',
      formattedTotalPayout: `$${(betAmount || 0).toFixed(2)}`
    };
  }

  let winnings;

  if (odds > 0) {
    // Positive odds: winnings = (betAmount * odds) / 100
    winnings = (betAmount * odds) / 100;
  } else {
    // Negative odds: winnings = betAmount / (|odds| / 100)
    winnings = betAmount / (Math.abs(odds) / 100);
  }

  const totalPayout = betAmount + winnings;

  return {
    winnings: parseFloat(winnings.toFixed(2)),
    totalPayout: parseFloat(totalPayout.toFixed(2)),
    formattedWinnings: `$${winnings.toFixed(2)}`,
    formattedTotalPayout: `$${totalPayout.toFixed(2)}`
  };
}

/**
 * Format odds display with proper + sign
 * @param {number} odds - American odds
 * @returns {string} Formatted odds string
 */
export function formatOdds(odds) {
  if (!odds && odds !== 0) return 'N/A';
  return odds > 0 ? `+${odds}` : `${odds}`;
}

/**
 * Calculate the implied probability from American odds
 * @param {number} odds - American odds
 * @returns {number} Implied probability as a percentage (0-100)
 */
export function calculateImpliedProbability(odds) {
  if (!odds) return 0;

  if (odds > 0) {
    return (100 / (odds + 100)) * 100;
  } else {
    return (Math.abs(odds) / (Math.abs(odds) + 100)) * 100;
  }
} 