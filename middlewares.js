/** @format */

const db = require("./singletons/db");
const CONSTANTS = require("./singletons/constants");

const redis = require("redis");
const myUtils = require("./utils");

const Inventory = require("./models/inventory");
const Player = require("./models/player.js");
const Balance = require("./models/player-cashout.js");
const Buoy = require("./models/buoy.js");

const middleware = {};

const client = redis.createClient();
client.connect().then(); // to make sure that the client has been properly awaited

/**
 * Checks the castable status of a buoy
 * If its spooked, therefore its not fishable
 * @param {*} res the resource to be sent for custom spooked response
 * @param {string} buoy_uuid the uuid of the buoy the player is fishing on
 * @param {string} player_uuid the uuid of the fishing player
 * @return {boolean} `true` its if its castable and `false` when its spooked (not castable) otherwise
 */
function checkSpook(res, buoy_uuid, player_uuid) {
    try {
        const fishedBuoy = Buoy.fromDB(buoy_uuid);
        const rows = fishedBuoy.getCastsAndSpookTime(buoy_uuid, player_uuid);
        const dateSql = myUtils.sqlToJSDateUTC(rows.previous_spook_time);
        const timeDifference = myUtils.getRemainingMiliseconds(dateSql);
        const remainingTime = myUtils.getHHMMSSFromMiliseconds(timeDifference);
        const isSpooked = fishedBuoy.checkSpook(player_uuid);

        if (isSpooked) {
            if (!myUtils.isWithinADay(dateSql)) {
                fishedBuoy.spook(player_uuid);
            }
            var msg = `Oops, You have Spooked this buoy, you can come back in ${remainingTime}`;
            res
                .status(CONSTANTS.HTTP.TOO_MANY_REQUESTS)
                .json(myUtils.generateJSONSkeleton(msg, CONSTANTS.HTTP.TOO_MANY_REQUESTS));
            return false; // fail
        }
        return true; // success
    } catch (err) {
        throw err;
    }
}

/**
 * Generates the fish jackpot (fishpot) winning message 
 * when the player gets one
 * @param {string} player_username the username of the player that got the fishpot
 * @param {string} numberString the formatted jackpot value in 2 decimal point
 * @param {string} location the buoy location name (if configured by the buoy owner)
 * @return {string} the fishpot message
 */
function generateFishpotMessage(player_username, numberString, location) {
    let msg = `
=============================
FISHPOT WINNER 

Congratulations to ${player_username}
That has won the ${numberString} L$ fishpot of this buoy 
In ${location}
=============================
    `;
    return msg;
}

/**
 * Handles the registration process of a player and 
 * updating the player information (username/display name)
 * @param {Express.Request} req the request body which contains these properties
 * @property {string} player_uuid the unique uuid of each player, for identification purposes
 * @property {string} player_username the unique username of the player, for in game identification only
 * @property {string} player_display_name the display name of a player, for customization purposes
 * 
 * @param {Express.Response} res the result message which would return the error message here
 * @param {Express.NextFunction} next the function to continue to the next middleware or the endpoint
 */
middleware.playerRegisterMiddleware = function registerPlayerMiddleware(req, res, next) {
    try {
        const params = {
            player_uuid: req.query.player_uuid,
            player_username: req.query.player_username,
            player_display_name: req.query.player_display_name
        };
        myUtils.ensureParametersOrValueNotNull(params);

        const isExists = Player.isExists(params.player_uuid);

        if (isExists) {
            const player = Player.fromDB(params.player_uuid);
            if (player.player_username !== params.player_username) {
                player.player_username = params.player_username;
                player.changeUsername();
                next();
            }
            if (player.player_display_name !== params.player_display_name) {
                player.player_display_name = params.player_display_name;
                player.changeDisplayName();
                next();
            }
            // else next normally
            next();
        }
        else {
            const newPlayer = new Player(params.player_uuid, params.player_username, params.player_display_name);
            const newInventory = new Inventory({ player_uuid: params.player_uuid });
            const newBalance = new Balance({ player_uuid: params.player_uuid });

            const insertPlayerTransaction = db.transaction(function () {
                newPlayer.addToDB();
                newInventory.addToDB();
                newBalance.addToDB();
            });
            insertPlayerTransaction();
            next();
        }
    }
    catch (err) {
        myUtils.handleError(err, res);
    }
};
/**
 * Handles the cast verification process, using Redis caching process
 * This middleware has been designed to minimize verification queries on the database
 * So only when the cast reaches the limit, or the player changes buoy, then the verification process is done
 * @param {Express.Request} req the request body which contains these properties
 * @property {string} player_uuid the unique uuid of each player, for identification purposes
 * @property {string} player_username the unique username of the player, for in game identification only
 * @property {string} buoy_uuid the unique uuid of the buoy that the player is fishing on
 * @property {string} rod_uuid the unique uuid of the rod owned by the player
 * 
 * @param {Express.Response} res the result message which would return the error message here
 * @param {Express.NextFunction} next the function to continue to the next middleware or the endpoint
 */
middleware.castMiddleware = async function castCacheMiddleware(req, res, next) {
    try {
        const params = {
            player_uuid: req.query.player_uuid,
            player_username: req.query.player_username,
            buoy_uuid: req.query.buoy_uuid,
            rod_uuid: req.query.rod_uuid,
        };
        myUtils.ensureParametersOrValueNotNull(params);

        const fishedBuoy = Buoy.fromDB(params.buoy_uuid);
        req.params = params; // this would simplify the code in the route
        const keyString = params.buoy_uuid.toString() + params.rod_uuid.toString() + params.player_uuid.toString();
        const value = await client.get(keyString);
        const valueObject = JSON.parse(value);

        if (
            !valueObject ||
            valueObject.currentBuoy !== params.buoy_uuid
        ) {
            let loginStatus = checkSpook(
                res,
                params.buoy_uuid,
                params.player_uuid
            );
            let castInfo = fishedBuoy.getCastsAndSpookTime(
                params.buoy_uuid,
                params.player_uuid
            );

            // if u can login then add cache
            if (loginStatus === true) {
                const valueString = JSON.stringify({
                    currentBuoy: params.buoy_uuid,
                    casts: castInfo.casts + 1, // to account updated value later
                });
                client.set(keyString, valueString);
                next();
            }
        } else {
            if (valueObject.casts >= CONSTANTS.CAST_LIMIT) {
                let status = checkSpook(res, params.buoy_uuid, params.player_uuid);
                if (status === true) {
                    // reset cast
                    let castInfo = fishedBuoy.getCastsAndSpookTime(
                        params.buoy_uuid,
                        params.player_uuid
                    );
                    valueObject.casts = castInfo.casts + 1; // this works due to a trigger
                    client.set(keyString, JSON.stringify(valueObject));
                    next(); // if the counter is finally over
                }
            } else {
                valueObject.casts += 1;
                client.set(keyString, JSON.stringify(valueObject));
                next();
            }
        }
    } catch (err) {
        myUtils.handleError(err, res);
    }
};

/**
 * Blocks casting if the timeout cache still exists, using Redis caching process
 * @param {Express.Request} req the request body which contains these properties
 * @property {string} player_uuid the unique uuid of each player, for identification purposes
 * @property {string} player_username the unique username of the player, for in game identification only
 * @property {string} buoy_uuid the unique uuid of the buoy that the player is fishing on
 * @property {string} rod_uuid the unique uuid of the rod owned by the player
 * 
 * @param {Express.Response} res the result message which would return the error message here
 * @param {Express.NextFunction} next the function to continue to the next middleware or the endpoint
 */
middleware.timeoutMiddleware = async function timeoutMiddleware(req, res, next) {
    const key = req.query.buoy_uuid.toString() + req.query.rod_uuid.toString();

    try {
        const value = await client.get(key);
        const msg = `Wait a moment, your fishing rod is not ready yet`;
        if (value) {
            // ttl for debugging
            // console.debug(await client.ttl(key));
            res.status(CONSTANTS.HTTP.TOO_MANY_REQUESTS).json(
                myUtils.generateJSONSkeleton(msg, CONSTANTS.HTTP.TOO_MANY_REQUESTS)
            );
        }
        else {
            next();
        }
    } catch (err) {
        myUtils.handleError(err, res);
    }
};

/**
 * Handles fishpot, and awards the lucky player if the probability suffices
 * @param {Express.Request} req the request body which contains these properties
 * @property {string} player_uuid the unique uuid of each player, for identification purposes
 * @property {string} player_username the unique username of the player, for in game identification only
 * @property {string} buoy_uuid the unique uuid of the buoy that the player is fishing on
 * @property {string} rod_uuid the unique uuid of the rod owned by the player
 * 
 * @param {Express.Response} res the result message which would return the error message here
 * @param {Express.NextFunction} next the function to continue to the next middleware or the endpoint
 */
middleware.fishpotMiddleware = function fishpotMiddleware(req, res, next) {
    try {
        const balanceManager = Balance.fromDB(req.params.player_uuid);
        const buoyManager = Buoy.fromDB(req.params.buoy_uuid);

        if (
            Math.random() < CONSTANTS.FISHPOT_RATE &&
            buoyManager.fishpot > CONSTANTS.FISHPOT_MINIMUM
        ) {
            const fishpotString = buoyManager.getFishpot(balanceManager);
            const fishpotMessage = generateFishpotMessage(
                req.params.player_username,
                fishpotString,
                buoyManager.buoy_location_name
            );
            return res.json(myUtils.generateJSONSkeleton(fishpotMessage));
        }
        else {
            return next();
        }
    }
    catch (err) {
        myUtils.handleError(err, res);
    }
};

module.exports = middleware;