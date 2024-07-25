const constants = {
    HTTP: {
        OK: 200,
        FORBIDDEN: 400,
        NOT_FOUND: 404,
        CONFLICT: 409,
        TOO_MANY_REQUESTS: 429,
        INTERNAL_SERVER_ERROR: 500
    },
    TIMEOUT: {
        SMALL_WORMS: 75,
        TASTY_WORMS: 60,
        ENCHANTED_WORMS: 45,
        MAGIC_WORMS: 30
    },
    BALANCE_CUT: 1 - this.TAX,
    CAST_LIMIT: 51,
    FISPOT_RATE: 0.01,
    MILISECONDS_IN_DAY: 24 * 60 * 60 * 1000,
    TAX: 0.15, // temporal flat 15% tax
    TEMP_XP: 1,
};

module.exports = constants;