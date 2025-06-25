/**
 * Test script to verify timezone formatting
 * This shows how timestamps should be displayed consistently across all bet components
 */

// Example of correct timezone formatting:
const exampleBet = {
  created_at_formatted: {
    date: "Dec 24, 2024",
    time: "6:15 PM", 
    timezone: "EST"
  },
  status_changed_at_formatted: {
    date: "Dec 24, 2024",
    time: "6:20 PM",
    timezone: "EST"
  }
};

// ✅ CORRECT: Shows timezone
console.log(`Placed: ${exampleBet.created_at_formatted.date} at ${exampleBet.created_at_formatted.time} (${exampleBet.created_at_formatted.timezone})`);

// ✅ CORRECT: Shows timezone
console.log(`Sold: ${exampleBet.status_changed_at_formatted.date} at ${exampleBet.status_changed_at_formatted.time} (${exampleBet.status_changed_at_formatted.timezone})`);

// The issue: Some places were missing the timezone part
// ❌ WRONG: Missing timezone
console.log(`Placed: ${exampleBet.created_at_formatted.date} at ${exampleBet.created_at_formatted.time}`);

module.exports = { exampleBet }; 