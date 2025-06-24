/**
 * Script to fix odds mapping issue
 * This script demonstrates the correct way to map odds to teams
 */

// Example of how odds should be mapped properly
function fixOddsMapping(game, rawOdds) {
    // Find odds by team name instead of relying on array order
    const homeTeamOdds = rawOdds.find(odd => odd.name === game.home_team);
    const awayTeamOdds = rawOdds.find(odd => odd.name === game.away_team);
    
    // Create properly ordered odds array
    // Index 0 = Home team (guaranteed)
    // Index 1 = Away team (guaranteed)
    const orderedOdds = [
        homeTeamOdds || { name: game.home_team, price: null },
        awayTeamOdds || { name: game.away_team, price: null }
    ];
    
    console.log(`📊 Fixed mapping for ${game.home_team} vs ${game.away_team}:`);
    console.log(`   Home (${game.home_team}): ${homeTeamOdds?.price || 'N/A'}`);
    console.log(`   Away (${game.away_team}): ${awayTeamOdds?.price || 'N/A'}`);
    
    return orderedOdds;
}

// Instructions for manual fix:
console.log('To fix odds mapping in server.js:');
console.log('1. Find line ~219: const odds = game.bookmakers?.[0]?.markets?.[0]?.outcomes || [];');
console.log('2. Replace with the logic from this script');
console.log('3. This ensures odds[0] = home team, odds[1] = away team always');

module.exports = { fixOddsMapping }; 