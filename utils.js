const CONSTANTS = require("./singletons/constants");
const utils = {};

// These code is the most reused code in the entire codebase, 
// mainly about response, error and time handling

/**
 * An error class specifically used to handle parameters being null, undefined or NaN
 *
 * @class BadRequestFormatError
 * @extends {Error}
 */
class BadRequestFormatError extends Error {
    constructor() {
        const message = "Null, undefined or NaN parameter value(s)";
        super(message);

        this.message = message;
    }
}

utils.BadRequestFormatError = BadRequestFormatError;

/**
 * Default Error Handling template, for HTTP BAD_REQUEST 400 and INTERNAL_SERVER_ERROR 500
 * @param {Error} err The error object to be handled
 * @param {Express.Response} res The error response object to be sent
 */
utils.handleError = function handleError(err, res) {
    if (err instanceof BadRequestFormatError) {
        jsonOutput = {
            message: err.message,
            status: CONSTANTS.HTTP.BAD_REQUEST,
            debugStack: err.stack,
        };
        res.status(jsonOutput["status"]).json(jsonOutput);
    }
    else {
        jsonOutput = {
            message: "the database blew up",
            status: CONSTANTS.HTTP.INTERNAL_SERVER_ERROR,
            debugMsg: err.message,
            debugStack: err.stack,
        };
        res.status(jsonOutput["status"]).json(jsonOutput);
    }
};

// TODO : make a function that directly handles the response with the status

/**
 * Generates basic template of the response JSON
 * @param {*|string} objectOrMessage The response object to be sent
 * @param {*} [httpCode=CONSTANTS.HTTP.OK] The HTTP code of the message, defaults to 200 OK
 * @return {*} The JSON that is going to be returned for response objects 
 */
utils.generateJSONSkeleton = function generateJSONSkeleton(objectOrMessage, httpCode = CONSTANTS.HTTP.OK) {
    return {
        message: objectOrMessage,
        status: httpCode,
    };
};

/**
 * Checks the parameter or object is not undefined, null, or NaN if a number
 * 
 * Does nothing if everything is a valid value, else throws `BadRequestFormatError`
 * @param {*} paramObject
 */
utils.ensureParametersOrValueNotNull = function ensureParametersOrValueNotNull(paramObject) {
    if (paramObject === null || paramObject === undefined || Number.isNaN(paramObject)) {
        throw new BadRequestFormatError();
    }
    for (let key in paramObject) {
        if (paramObject[key] === null || paramObject[key] === undefined || Number.isNaN(paramObject)) {
            throw new BadRequestFormatError();
        }
    }
};

/**
 * Converts SQL DATETIME string to JavaScript `Date` object
 * @param {string} sqlDate The DATETIME string from the database 
 * @return {Date} the converted `Date` object
 */
utils.sqlToJSDateUTC = function sqlToJsDateUTC(sqlDate) {
    // Split the SQL datetime string into an array
    var sqlDateArr = sqlDate.split("-");
    var year = parseInt(sqlDateArr[0]);
    var month = parseInt(sqlDateArr[1]) - 1; // Months are zero-based in JavaScript
    var dayTime = sqlDateArr[2].split(" ");
    var day = parseInt(dayTime[0]);
    var time = dayTime[1].split(":");
    var hour = parseInt(time[0]);
    var minute = parseInt(time[1]);
    var second = parseInt(time[2]);

    // Create a new Date object
    var jsDate = new Date(Date.UTC(year, month, day, hour, minute, second));

    return jsDate;
};

/**
 * Checks if the `Date` object is weekend or not 
 * 
 * Assumes Saturday and Sunday as weekend
 * @param {Date} datetime The `Date` object to be checked
 * @return {boolean} the value of the date being weekend or not
 */
utils.isWeekend = function isWeekend(datetime) {
    let day = datetime.getDay();
    let WEEKEND_DAYS = CONSTANTS.DAYS;
    return (day === WEEKEND_DAYS.SATURDAY || day === WEEKEND_DAYS.SUNDAY);
};

/**
 * Checks the remaining time from a datetime from today
 * @param {Date} dateObject The date (within a day)
 * @return {number} The remaining miliseconds. May be negative if its already past now
 */
utils.getRemainingMiliseconds = function getRemainingMiliseconds(dateObject) {
    const dateAfterTwentyFourHours = new Date(dateObject);
    dateAfterTwentyFourHours.setUTCDate(dateObject.getUTCDate() + 1);

    const now = new Date();
    const timeDifference = dateAfterTwentyFourHours.getTime() - now.getTime();
    return timeDifference;
};

/**
 * Converts miliseconds to hh:mm:ss format
 * @param {number} miliseconds the miliseconds to be converted (24 hours or less)
 * @return {string} The hh:mm:ss string 
 */
utils.getHHMMSSFromMiliseconds = function getHHMMSSFromMiliseconds(miliseconds) {
    const date_hh_mm_ss = new Date(null);
    date_hh_mm_ss.setTime(miliseconds);
    const remainingTime = date_hh_mm_ss.toISOString().slice(11, 19); // hh:mm:ss slice
    return remainingTime;
};

/**
 * Converts the long trail floating point number to a string of custom decimal points
 * 
 * `0.30000000000000004 => 0.30`
 * @param {*} numberLike
 * @param {number} [digits=2]
 * @return {string} 
 */
utils.roundToFixed = function roundToFixed(numberLike, digits = 2) {
    const number = Number(numberLike);
    return number.toFixed(digits);
};

/**
 * Checks if the `Date` object is within 24 hours of now
 * @param {Date} date The `Date` object to be compared
 * @return {boolean} The value of the date being within 24 hours or now
 */
utils.isWithinADay = function isWithinADay(date) {
    const now = Date.now();
    const dateMs = date.getTime();
    const remainingTime = now - dateMs;
    return (remainingTime < CONSTANTS.MILISECONDS_IN_DAY);
};

module.exports = utils;