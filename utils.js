const CONSTANTS = require("./singletons/constants");
const utils = {};

class BadRequestFormatError extends Error {
    constructor() {
        const message = "Null, undefined or NaN parameter value(s)";
        super(message);

        this.message = message;
    }
}

utils.BadRequestFormatError = BadRequestFormatError;

// default handling of error
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

// generate standardized structure of json
utils.generateJSONSkeleton = function generateJSONSkeleton(objectOrMessage, httpCode = CONSTANTS.HTTP.OK) {
    return {
        message: objectOrMessage,
        status: httpCode,
    };
};

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

utils.isWeekend = function isWeekend(datetime) {
    let day = datetime.getDay();
    let WEEKEND_DAYS = CONSTANTS.DAYS;
    return (day === WEEKEND_DAYS.SATURDAY || day === WEEKEND_DAYS.SUNDAY);
};

utils.getRemainingMiliseconds = function getRemainingMiliseconds(dateObject) {
    const dateAfterTwentyFourHours = new Date(dateObject);
    dateAfterTwentyFourHours.setUTCDate(dateObject.getUTCDate() + 1);

    const now = new Date();
    const timeDifference = dateAfterTwentyFourHours.getTime() - now.getTime();
    return timeDifference;
};

utils.getHHMMSSFromMiliseconds = function getHHMMSSFromMiliseconds(miliseconds) {
    const date_hh_mm_ss = new Date(null);
    date_hh_mm_ss.setTime(miliseconds);
    const remainingTime = date_hh_mm_ss.toISOString().slice(11, 19);
    return remainingTime;
};

utils.roundToFixed = function roundToFixed(numberLike, digits = 2) {
    const number = Number(numberLike);
    return number.toFixed(digits);
};

utils.isWithinADay = function isWithinADay(date) {
    const now = Date.now();
    const dateMs = date.getTime();
    const remainingTime = now - dateMs;
    return (remainingTime < CONSTANTS.MILISECONDS_IN_DAY);
};

utils.isNotNullOrUndefined = (obj) => { return (typeof obj !== 'undefined' && obj !== null); };

module.exports = utils;