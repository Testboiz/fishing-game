/** @format */

const db = require("better-sqlite3")("./fish-hunt.db");
const redis = require("redis");
const myUtils = require("./utils");

const buoyCache = {};
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
        myUtils.handleDBError(err, res);
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
        const HTTP_TOO_MANY_REQUESTS = 429;
        const MILISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

        const rows = getCastsAndSpookTime(res, buoy_uuid, player_username);
        const dateSql = sqlToJsDateUTC(rows.previous_spook_time);
        const timeDifference = getRemainingTime(dateSql);

        const date_hh_mm_ss = new Date(null);
        date_hh_mm_ss.setTime(timeDifference);
        const remainingTime = date_hh_mm_ss.toISOString().slice(11, 19);

        if (
            rows.casts === 0 &&
            timeDifference <= MILISECONDS_IN_DAY &&
            timeDifference >= 0
        ) {
            var msg = `Oops, You have Spooked this buoy, you can come back in ${remainingTime}`;
            res
                .status(HTTP_TOO_MANY_REQUESTS)
                .json(myUtils.generateJSONSkeleton(msg, HTTP_TOO_MANY_REQUESTS));
            return false; // fail
        }
        return true; // success
    } catch (err) {
        throw err;
    }
}

middleware.playerRegisterMiddleware = function registerPlayerMiddleware(req, res, rext) {
    const params = {
        player_username: req.query.player_username,
        player_display_name: req.query.player_display_name
    };
    myUtils.ensureParametersOrValueNotNull(params);
    const sql = `SELECT player_username FROM players WHERE player_username = ?`;
    const stmt = db.prepare(sql);
    const rows = stmt.get(params.player_username);

    if (rows) {
        next();
    }
    else {
        const sqlInsert = `
INSERT INTO players 
(player_username, player_display_name, linden_balance) 
VALUES (?,?,0)`;
        const stmtInsert = db.prepare(sqlInsert);
        stmtInsert.run(params.player_username, params.player_display_name);
        next();
    }
};

middleware.castMiddleware = function castCacheMiddleware(req, res, next) {
    try {
        const params = {
            player_username: req.query.player_username,
            buoy_uuid: req.query.buoy_uuid,
            rod_uuid: req.query.rod_uuid,
        };
        myUtils.ensureParametersOrValueNotNull(params);
        req.params = params; // this would simplify the code in the route

        const rod_id = params.rod_uuid;
        if (
            !buoyCache[rod_id] ||
            buoyCache[rod_id].currentBuoy !== params.buoy_uuid
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
                buoyCache[rod_id] = {
                    currentBuoy: params.buoy_uuid,
                    casts: castInfo.casts + 1, // to account updated value later
                };
                next();
            }
        } else {
            const CAST_LIMIT = 51;
            if (buoyCache[rod_id].casts === CAST_LIMIT) {
                let status = checkSpook(res, params.buoy_uuid, params.player_username);
                if (status === true) {
                    // reset cast
                    let castInfo = getCastsAndSpookTime(
                        res,
                        params.buoy_uuid,
                        params.player_username
                    );
                    console.log(castInfo);
                    buoyCache[rod_id].casts = castInfo.casts + 1;
                    next(); // if the counter is finally over
                }
            } else {
                buoyCache[rod_id].casts += 1;
                next();
            }
        }
    } catch (err) {
        myUtils.handleDBError(err, res);
    }
};

middleware.timeoutMiddleware = async function timeoutMiddleware(req, res, next) {
    const key = req.query.buoy_uuid.toString() + req.query.rod_uuid.toString();
    const HTTP_TOO_MANY_REQUESTS = 429;

    try {
        const value = await client.get(key);
        const msg = `Wait a moment, your fishing rod is not ready yet`;
        if (value) {
            res.status(HTTP_TOO_MANY_REQUESTS).json(
                myUtils.generateJSONSkeleton(msg, HTTP_TOO_MANY_REQUESTS)
            );
        }
        else {
            next();
        }
    } catch (err) {
        myUtils.handleDBError(err, res);
    }
};
module.exports = middleware;