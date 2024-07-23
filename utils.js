const utils = {};

// default handling of error
utils.handleDBError = function handleDBError(err, res) {
    jsonOutput = {
        message: "the database blew up",
        status: 500,
        debugMsg: err.message,
        debugStack: err.stack,
    };
    res.status(jsonOutput["status"]).json(jsonOutput);
};

// generate standardized structure of json
utils.generateJSONSkeleton = function generateJSONSkeleton(objectOrMessage, httpCode) {
    return {
        message: objectOrMessage,
        status: httpCode,
    };
};

utils.ensureParametersOrValueNotNull = function ensureParametersOrValueNotNull(paramObject) {
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