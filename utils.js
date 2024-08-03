const CONSTANTS = require("./constants");
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

utils.isNotNullOrUndefined = (obj) => { return (typeof obj !== 'undefined' && obj !== null); };

module.exports = utils;