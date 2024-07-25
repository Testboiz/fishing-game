const { c } = require("docker/src/languages");
const CONSTANTS = require("./constants");
const utils = {};

// default handling of error
utils.handleDBError = function handleDBError(err, res) {
    jsonOutput = {
        message: "the database blew up",
        status: CONSTANTS.HTTP.INTERNAL_SERVER_ERROR,
        debugMsg: err.message,
        debugStack: err.stack,
    };
    res.status(jsonOutput["status"]).json(jsonOutput);
};

// generate standardized structure of json
utils.generateJSONSkeleton = function generateJSONSkeleton(objectOrMessage, httpCode = CONSTANTS.HTTP.OK) {
    return {
        message: objectOrMessage,
        status: httpCode,
    };
};

utils.ensureParametersOrValueNotNull = function ensureParametersOrValueNotNull(paramObject) {
    console.log(paramObject);
    if (paramObject === null || paramObject === undefined) {
        throw new Error("The value is null or undefined");
    }
    for (let key in paramObject) {
        if (paramObject[key] === null || paramObject[key] === undefined) {
            throw new Error("One of the params are null or undefined");
        }
    }
};

module.exports = utils;