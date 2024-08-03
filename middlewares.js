/** @format */

const db = require("better-sqlite3")("./fish-hunt.db");
const redis = require("redis");
const myUtils = require("./utils");

const CONSTANTS = require("./constants");

const middleware = {};

const client = redis.createClient();
client.connect().then();

function sqlToJsDateUTC(sqlDate) {
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
}

function getCastsAndSpookTime(res, buoy_uuid, player_username) {
    try {
        const sql = `
SELECT casts, previous_spook_time FROM buoy_casts
WHERE buoy_uuid = ? AND player_username = ?;`;
        const stmt = db.prepare(sql);
        const rows = stmt.get(buoy_uuid, player_username);
        return rows;
    } catch (err) {
        myUtils.handleError(err, res);
    }
}

function getRemainingTime(spookDate) {
    const dateAfterTwentyFourHours = new Date(spookDate);
    dateAfterTwentyFourHours.setUTCDate(spookDate.getUTCDate() + 1);

    const now = new Date();
    const timeDifference = dateAfterTwentyFourHours.getTime() - now.getTime();
    return timeDifference;
}

function buoyLogin(res, buoy_uuid, rod_uuid, player_username) {
    try {
        const query = "UPDATE rod_info SET buoy_fished = ? WHERE rod_uuid = ? ";
        myUtils.ensureParametersOrValueNotNull(buoy_uuid);
        const stmt = db.prepare(query);
        stmt.run(buoy_uuid, rod_uuid);
        if (checkSpook(res, buoy_uuid, player_username)) {
            return true; // success
        } else {
            return false; // fail
        }
    } catch (err) {
        throw err;
    }
}

function checkSpook(res, buoy_uuid, player_username) {
    try {
        const rows = getCastsAndSpookTime(res, buoy_uuid, player_username);
        const dateSql = sqlToJsDateUTC(rows.previous_spook_time);
        const timeDifference = getRemainingTime(dateSql);

        const date_hh_mm_ss = new Date(null);
        date_hh_mm_ss.setTime(timeDifference);
        const remainingTime = date_hh_mm_ss.toISOString().slice(11, 19); // remaining time in hh:mm:ss

        if (
            rows.casts === 0 &&
            timeDifference <= CONSTANTS.MILISECONDS_IN_DAY &&
            timeDifference >= 0
        ) {
            console.debug("rows :" + rows);
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

middleware.playerRegisterMiddleware = function registerPlayerMiddleware(req, res, next) {
    try {
        const params = {
            player_username: req.query.player_username,
            player_display_name: req.query.player_display_name
        };
        myUtils.ensureParametersOrValueNotNull(params);
        const sql = `SELECT player_username FROM player WHERE player_username = ?`;
        const stmt = db.prepare(sql);
        const rows = stmt.get(params.player_username);

        if (rows) {
            if (rows.player_display_name === params.player_display_name) {
                next();
            }
            else {
                const sqlUpdate = `UPDATE player SET player_display_name = ? WHERE player_username = ?`;
                const stmtUpdate = db.prepare(sqlUpdate);
                stmtUpdate.run(params.player_display_name, params.player_username);
                next();
            }
        }
        else {
            const sqlInsert = `
    INSERT INTO player
    (player_username, player_display_name, linden_balance) 
    VALUES (?,?,0)`;
            const stmtInsert = db.prepare(sqlInsert);
            stmtInsert.run(params.player_username, params.player_display_name);
            next();
        }
    }
    catch (err) {
        myUtils.handleError(err, res);
    }
};

middleware.castMiddleware = async function castCacheMiddleware(req, res, next) {
    try {
        const params = {
            player_username: req.query.player_username,
            buoy_uuid: req.query.buoy_uuid,
            rod_uuid: req.query.rod_uuid,
        };
        myUtils.ensureParametersOrValueNotNull(params);

        req.params = params; // this would simplify the code in the route
        const keyString = params.buoy_uuid.toString() + params.rod_uuid.toString() + params.player_username.toString();
        const value = await client.get(keyString);
        const valueObject = JSON.parse(value);

        if (
            !valueObject ||
            valueObject.currentBuoy !== params.buoy_uuid
        ) {
            let loginStatus = buoyLogin(
                res,
                params.buoy_uuid,
                params.rod_uuid,
                params.player_username
            );
            let castInfo = getCastsAndSpookTime(
                res,
                params.buoy_uuid,
                params.player_username
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
            if (valueObject.casts === CONSTANTS.CAST_LIMIT) {
                let status = checkSpook(res, params.buoy_uuid, params.player_username);
                if (status === true) {
                    // reset cast
                    let castInfo = getCastsAndSpookTime(
                        res,
                        params.buoy_uuid,
                        params.player_username
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

// TODO : fishpot shouldn't be too common for small wins
middleware.fishpotMiddleware = function fishpotMiddleware(req, res, next) {
    const sqlGetFishpot = `SELECT fishpot, buoy_location_name FROM buoy WHERE buoy_uuid = ?`;
    const sqlResetFishpot = `UPDATE buoy SET fishpot = 0 WHERE buoy_uuid = ?`;
    const sqlUpdateAfterFishpot = `
UPDATE player 
SET 
    linden_balance = linden_balance + ?
    WHERE player_username = ?;
    `;
    try {
        let fishpotInfo, msg;
        const fishpotTransaction = db.transaction(function () {
            // preparation is here to minimize database use
            const stmtGetFishpot = db.prepare(sqlGetFishpot);
            const stmtResetFishpot = db.prepare(sqlResetFishpot);
            const stmtUpdateAfterFishpot = db.prepare(sqlUpdateAfterFishpot);

            fishpotInfo = stmtGetFishpot.get(req.params.buoy_uuid);
            stmtResetFishpot.run(req.params.buoy_uuid);
            stmtUpdateAfterFishpot.run(fishpotInfo.fishpot, req.params.player_username);

            const fishpotNumber = Number(fishpotInfo.fishpot);
            const numberString = fishpotNumber.toFixed(2);
            msg = `
=============================
FISHPOT WINNER 

Congratulations to ${req.params.player_username}
That has won the ${numberString} L$ fishpot of this buoy 
In ${fishpotInfo.buoy_location_name}
=============================
    `;
        });
        if (Math.random() < CONSTANTS.FISHPOT_RATE) {
            fishpotTransaction();
            res.json(myUtils.generateJSONSkeleton(msg));
        }
        else {
            next();
        }
    }
    catch (err) {
        myUtils.handleError(err, res);
    }
};

module.exports = middleware;