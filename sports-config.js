/**
 * Centralized Sports Configuration
 * 
 * This file manages all sport-specific settings, API mappings, and configurations.
 * It provides a unified interface for handling different sports leagues and makes
 * it easy to add new leagues or switch between different odds API providers.
 */

/**
 * Sports API Configuration
 * Maps our internal sport codes to different API providers
 */
const API_PROVIDERS = {
    ODDS_API: {
        name: 'The Odds API',
        baseUrl: 'https://api.the-odds-api.com/v4',
        sports: {
            NFL: 'americanfootball_nfl',
            NBA: 'basketball_nba', 
            MLB: 'baseball_mlb',
            NHL: 'icehockey_nhl',
            NCAAF: 'americanfootball_ncaaf',
            NCAAB: 'basketball_ncaab',
            MLS: 'soccer_usa_mls',
            EPL: 'soccer_epl',
            CHAMPIONS_LEAGUE: 'soccer_uefa_champs_league',
            TENNIS_ATP: 'tennis_atp',
            TENNIS_WTA: 'tennis_wta',
            GOLF_PGA: 'golf_pga_championship',
            UFC: 'mma_mixed_martial_arts',
            BOXING: 'boxing_heavyweight',
            CRICKET_IPL: 'cricket_ipl',
            RUGBY_NRL: 'rugbyleague_nrl'
        },
        rateLimits: {
            requestsPerMonth: 500,
            requestsPerMinute: 25
        }
    }
};

/**
 * Unified Sports Configuration
 * Each sport has consistent settings regardless of API provider
 */
const SPORTS_CONFIG = {
    NFL: {
        displayName: 'NFL',
        fullName: 'National Football League',
        category: 'American Football',
        season: 'fall-winter',
        maxGamesPerFetch: 5,
        cacheMinutes: 60,
        minBetCutoff: 15, // minutes before game starts
        defaultTimezone: 'America/Toronto'
    },
    NBA: {
        displayName: 'NBA',
        fullName: 'National Basketball Association',
        category: 'Basketball',
        season: 'winter-spring',
        maxGamesPerFetch: 5,
        cacheMinutes: 60,
        minBetCutoff: 15,
        defaultTimezone: 'America/Toronto'
    },
    MLB: {
        displayName: 'MLB',
        fullName: 'Major League Baseball',
        category: 'Baseball',
        season: 'spring-fall',
        maxGamesPerFetch: 5,
        cacheMinutes: 60,
        minBetCutoff: 15,
        defaultTimezone: 'America/Toronto'
    },
    NHL: {
        displayName: 'NHL',
        fullName: 'National Hockey League',
        category: 'Hockey',
        season: 'fall-spring',
        maxGamesPerFetch: 5,
        cacheMinutes: 60,
        minBetCutoff: 15,
        defaultTimezone: 'America/Toronto'
    }
};

/**
 * Current API Provider Configuration
 * Change this to switch between different API providers
 */
const CURRENT_API_PROVIDER = 'ODDS_API';

/**
 * Get API-specific sport key for current provider
 * @param {string} sportCode - Internal sport code (e.g., 'NFL', 'NBA')
 * @returns {string} API-specific sport key
 */
function getApiSportKey(sportCode) {
    const provider = API_PROVIDERS[CURRENT_API_PROVIDER];
    return provider.sports[sportCode];
}

/**
 * Get all supported sports for UI display
 * @returns {Array} Array of sport options for frontend
 */
function getSupportedSports() {
    const provider = API_PROVIDERS[CURRENT_API_PROVIDER];
    return Object.keys(SPORTS_CONFIG)
        .filter(sport => provider.sports[sport]) // Only include sports supported by current API
        .map(sport => ({
            value: sport,
            label: SPORTS_CONFIG[sport].displayName,
            fullName: SPORTS_CONFIG[sport].fullName,
            category: SPORTS_CONFIG[sport].category
        }));
}

/**
 * Get sport configuration
 * @param {string} sportCode - Internal sport code
 * @returns {Object} Sport configuration object
 */
function getSportConfig(sportCode) {
    return SPORTS_CONFIG[sportCode];
}

/**
 * Get maximum games to fetch for a sport
 * @param {string} sportCode - Sport code
 * @returns {number} Maximum games to fetch
 */
function getMaxGamesForSport(sportCode) {
    const config = SPORTS_CONFIG[sportCode];
    return config ? config.maxGamesPerFetch : 5; // Default to 5
}

/**
 * Normalize team name across different APIs and naming conventions
 * @param {string} teamName - Team name from API
 * @param {string} sportCode - Sport code for context
 * @returns {string} Normalized team name
 */
function normalizeTeamName(teamName, sportCode) {
    // Remove common suffixes/prefixes that might vary
    return teamName.trim()
        .replace(/^(The\s+)/i, '') // Remove "The" prefix
        .replace(/\s+(FC|CF|United|City|Town)$/i, '') // Remove common soccer suffixes
        .trim();
}

/**
 * Validate if betting is allowed for a game based on start time
 * @param {string} gameDate - Game start time in ISO format
 * @param {string} sportCode - Sport code to get specific cutoff (unused now)
 * @returns {boolean} True if betting is allowed (game hasn't started yet)
 */
function isBettingAllowed(gameDate, sportCode) {
    const gameTime = new Date(gameDate);
    const now = new Date();
    
    // Only prevent betting if the game has actually started
    // Allow betting right up until game time
    return gameTime > now;
}

module.exports = {
    SPORTS_CONFIG,
    API_PROVIDERS,
    CURRENT_API_PROVIDER,
    getApiSportKey,
    getSupportedSports,
    getSportConfig,
    getMaxGamesForSport,
    normalizeTeamName,
    isBettingAllowed
}; 