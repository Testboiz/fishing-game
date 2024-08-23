const constants = {
    BASE_XP: {
        BEGINNER: 1,
        PRO: 2,
        DELUXE: 4,
        MAGIC: 8,
        SHARK: 8,
        COMP_1: 10,
        COMP_2: 12
    },
    HTTP: {
        OK: 200,
        BAD_REQUEST: 400,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        CONFLICT: 409,
        TOO_MANY_REQUESTS: 429,
        INTERNAL_SERVER_ERROR: 500
    },
    DAYS: {
        SATURDAY: 6,
        SUNDAY: 0
    },
    ENUMS: {
        ROD: {
            BEGINNER: 1,
            PRO: 2,
            ENCHANTED: 3,
            MACIC: 4,
            SHARK: 5,
            COMP_1: 6, // maybe unused, only for compartibility 
            COMP_2: 7
        },
        BUOY_COLOR: {
            BLUE: "blue",
            YELLOW: "yellow",
            RED: "red"
        }
    },
    TIMEOUT: {
        SMALL_WORMS: 75,
        TASTY_WORMS: 60,
        ENCHANTED_WORMS: 45,
        MAGIC_WORMS: 30
    },
    TIME_BOOST_FACTOR: {
        ALACRITY: 0.85,
        SHUBBIE: {
            BLUE: 0.95,
            GREEN: 0.9,
            RED: 0.85
        }
    },
    BALANCE_CUT: 0.85, // temporal implementation
    CAST_LIMIT: 51,
    CASHOUT_DEFAULT_VALUE: 300,
    FISH_LOTTERY_RATE: 0.2,
    FISHPOT_RATE: 0.01,
    FISHPOT_MINIMUM: 30,
    MILISECONDS_IN_DAY: 24 * 60 * 60 * 1000,
    TAX: 0.15, // temporal flat 15% tax
    TEMP_XP: 1,
    TWO_DIGITS_PRECISION: 2
};

module.exports = constants;