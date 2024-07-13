const express = require('express');
const router = express.Router();
const db = require('better-sqlite3')('./fish-hunt.db');
db.pragma('journal_mode = WAL');

// default handling of error
function handleDBError(err, res){
    jsonOutput = {
        message : "the database blew up",
        status : 500,
        debugMsg : err.message
    };
    res.status(jsonOutput["status"]).json(jsonOutput);
}

// router.use(function (req,res,next){
//     // handle buoy login, if wants to cast
//     if (req.params.buoy_uuid){
//         // handle buoy login
//     }
//     next();
// })

// generate standardized structure of json
function generateJSONSkeleton(objectOrMessage, httpCode){
    return {
        message : objectOrMessage,
        status : httpCode
    };
}

function formatMultilineStringToNormal(inputString) {
    const escapedString = inputString.replace(/\n/g, '\\n');
    return escapedString;
}

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

function checkSpook(res, buoy_uuid, player_username) {
    try {
        const HTTP_TOO_MANY_REQUESTS = 429;
        const MILISECONDS_IN_DAY = 24*60*60*1000;
        const sql = `
SELECT casts, previous_spook_time FROM buoy_casts
WHERE buoy_uuid = ? AND player_username = ?;`;
        const stmt = db.prepare(sql);
        const rows = stmt.get(buoy_uuid, player_username);
        const dateSql = sqlToJsDateUTC(rows.previous_spook_time);

        const dateAfterTwentyFourHours = new Date(dateSql);
        dateAfterTwentyFourHours.setUTCDate(dateSql.getUTCDate() + 1);

        const now = new Date();
        const timeDifference = dateAfterTwentyFourHours.getTime() - now.getTime();

        const date_hh_mm_ss = new Date(null);
        date_hh_mm_ss.setTime(timeDifference); 
        const remainingTime = date_hh_mm_ss.toISOString().slice(11, 19);

        if (rows.casts === 0 && timeDifference <= MILISECONDS_IN_DAY && timeDifference >= 0){
            var msg = `Oops, You have Spooked this buoy, you can come back in ${remainingTime}`
            res.status(HTTP_TOO_MANY_REQUESTS).json(
                generateJSONSkeleton(msg,HTTP_TOO_MANY_REQUESTS))
            return false; // fail
        }
        return true; // success
    }
    catch (err){
        throw err;
    }
}


function ensureParametersOrValueNotNull(paramObject){
    if (paramObject === null || paramObject === undefined){
        throw new Error("The value is null or undefined");
    }
    for (let key in paramObject) {
        if (paramObject[key] === null || paramObject[key] === undefined) {
            throw new Error("One of the params are null or undefined");
        }
    }
}

function buoyLogin(res, buoy_uuid, rod_uuid, player_username){
    try{
        const query = "UPDATE rod_info SET buoy_fished = ? WHERE rod_uuid = ? ";
        ensureParametersOrValueNotNull(buoy_uuid);
        const stmt = db.prepare(query);
        stmt.run(buoy_uuid, rod_uuid); 
        if (checkSpook(res, buoy_uuid, player_username)){
            return true // success
        } else {
            return false // fail
        }
    }
    catch (err) {
        throw err
    }
}

router.get("/", function(_, res){
    res.json(generateJSONSkeleton("Server is up!", 200));
});


router.get("/auth", function(req,res){
    const query = "SELECT * FROM rod_info WHERE rod_uuid = ? AND player_username = ?";
    const stmt = db.prepare(query);

    try{
        const params = {
            id : req.query.id,
            username : req.query.username
        };

        ensureParametersOrValueNotNull(params);

        // parameters can be immmediately puy on the function, making the code cleaner
        const result = stmt.get(params.id,params.username);
        var jsonOutput = {}

        if (result){
            const HTTP_OK = 200;
            const msg = "Authorization Failed, Rod cannot be transferred to another player";
            jsonOutput = generateJSONSkeleton(msg, HTTP_OK);
        }
        else{
            const HTTP_ERR_FORBIDDEN = 403;
            const msg = "Authorization Failed, Rod cannot be transferred to another player";
            jsonOutput = generateJSONSkeleton(msg, HTTP_ERR_FORBIDDEN);
        }
        res.status(jsonOutput["status"]).json(jsonOutput);
    }
    catch (err){
        handleDBError(err,res);
    }

});

router.get("/fish", function(_, res){
    try{
        const rows = db.prepare("SELECT * FROM fish").all();
        res.json(generateJSONSkeleton(rows,200));
    }
    catch (err){
        handleDBError(err,res);
    }
});

router.put("/cast", function(req, res){
    const TEMP_XP = 1;
    const FISHPOT_RATE = 0.01;
    const sqlForFish = `
WITH probability AS (
    SELECT ABS(RANDOM() / CAST(-9223372036854775808 AS REAL)) AS probability
)
SELECT 
    f.fish_name, 
    f.fish_value,
    (SELECT buoy_multiplier FROM buoy WHERE buoy_uuid = ?) AS multiplier
FROM 
    fish AS f, 
    probability AS pr, 
    fish_probability AS p
        JOIN fish_probability ON (f.fish_probability_class = p.probability_class)
        JOIN probability ON pr.probability < p.probability_value OR f.fish_probability_class = 'Common'
        WHERE (pr.probability < p.probability_value OR f.fish_probability_class = 'Common') 
        ORDER BY RANDOM()
        LIMIT 1       
;
`;
    const sqlForRank = `
WITH ranked_fishers AS (
SELECT
    rank_overall.player_username,
    player.player_display_name,
    player.linden_balance,
    rank_overall.xp,
    RANK() OVER (ORDER BY rank_overall.xp DESC) AS rank
FROM
    rank_overall
LEFT JOIN 
    player ON rank_overall.player_username = player.player_username
)
SELECT
    ro1.player_username,
    ro1.player_display_name,
    ro1.linden_balance,
    ro1.xp,
    ro1.rank,
    ro2.player_display_name AS above_display_name,
    ro2.xp - ro1.xp AS xp_difference,
    ro2.rank AS above_rank
FROM
    ranked_fishers AS ro1
LEFT JOIN 
    ranked_fishers AS ro2 ON ro1.rank = ro2.rank + 1
WHERE ro1.player_username = ?;
    `;
    const sqlForWorms = `
UPDATE rod_info 
SET 
    small_worms = CASE WHEN selected_worm = 1 THEN small_worms - 1 ELSE small_worms END,
    tasty_worms = CASE WHEN selected_worm = 2 THEN tasty_worms - 1 ELSE tasty_worms END,
    enchanted_worms = CASE WHEN selected_worm = 3 THEN enchanted_worms - 1 ELSE enchanted_worms END,
    magic_worms = CASE WHEN selected_worm = 4 THEN magic_worms - 1 ELSE magic_worms END
WHERE rod_uuid = ?;
    `;
    const sqlWormInfo = `
SELECT small_worms, tasty_worms, enchanted_worms, magic_worms FROM rod_info WHERE rod_uuid = ?;
    `;
    const sqlForBuoys = `
UPDATE buoy 
    SET 
    buoy_balance = buoy_balance - ?,
    fishpot = fishpot +  ?
WHERE buoy_uuid = ?;
    `;
    const sqlForUpdateRank = `UPDATE rank_overall  SET xp = xp + ? WHERE player_username = ?; `
    const sqlCastHandling = `
INSERT INTO buoy_casts (buoy_uuid, player_username, casts) VALUES (?,?,0)
    ON CONFLICT (buoy_uuid, player_username) DO UPDATE SET casts = casts + 1;
    `;

    const sqlUpdateAfterCast = `
UPDATE player 
SET 
    linden_balance = linden_balance + ?
    WHERE player_username = ?;
    `
    try{
        const params = {
            player_username : req.query.player_username,
            buoy_uuid : req.query.buoy_uuid,
            rod_uuid : req.query.rod_uuid
        };

        ensureParametersOrValueNotNull(params);

        const stmtFish = db.prepare(sqlForFish);
        const stmtRank = db.prepare(sqlForRank);
        const stmtWorm = db.prepare(sqlForWorms);
        const stmtWormInfo = db.prepare(sqlWormInfo);
        const stmtBuoy = db.prepare(sqlForBuoys);
        const stmtForUpdateRank = db.prepare(sqlForUpdateRank);
        const stmtCastHandling = db.prepare(sqlCastHandling);
        const stmtupdateAfterCast = db.prepare(sqlUpdateAfterCast);

        // Note : would be refactored to reduce queries
        const loginSuccess = buoyLogin(res, params.buoy_uuid, params.rod_uuid, params.player_username);
        if (!loginSuccess) return;
        
        let fishCaught, wormInfo, rankInfo;

        const castTransaction = db.transaction(function(){
            stmtCastHandling.run(params.buoy_uuid,params.player_username);
            stmtWorm.run(params.rod_uuid);
        
            fishCaught = stmtFish.get(params.buoy_uuid);
            wormInfo = stmtWormInfo.get(params.rod_uuid);
            fish_value_multiplied = fishCaught.fish_value * fishCaught.multiplier;

            // if error, buoy empty
            stmtBuoy.run(fish_value_multiplied, fish_value_multiplied * FISHPOT_RATE, params.buoy_uuid)
        
            stmtForUpdateRank.run(TEMP_XP, params.player_username);
            stmtupdateAfterCast.run(fish_value_multiplied,params.player_username)

            rankInfo = stmtRank.get(params.player_username);
        });

        castTransaction();

        const debugObj = {
            worms : {
                small : wormInfo.small_worms,
                tasty : wormInfo.tasty_worms,
                enchanted : wormInfo.enchanted_worms,
                magic : wormInfo.magic_worms
            },
            fish : fishCaught.fish_name,
            xp : rankInfo.xp,
            debugCast : fishCaught.casts,
            earnings : {
                linden_balance : rankInfo.linden_balance,
                fish_value : fish_value_multiplied
            },
            rank_info : {
                rank : rankInfo.rank,
                xp_difference : rankInfo.xp_difference,
                above_display_name : rankInfo.above_display_name,
                above_rank : rankInfo.above_rank
            }
        };
        var message = `
Small Worms: ${wormInfo.small_worms}
Tasty Worms: ${wormInfo.tasty_worms}
Enchanted Worms: ${wormInfo.enchanted_worms}
Magic Worms: ${wormInfo.magic_worms}
Gold : Coming Soon!

You caught ${fishCaught.fish_name}
Fishing Exp: ${rankInfo.xp} (+1)
Fish: Coming Soon!
Your Earnings: ${rankInfo.linden_balance} L$ (+${fishCaught.fish_value}) 
RANK Extras!: Coming Soon!
Kingdoms Coming Soon! 

RANK (overall):  ${rankInfo.rank}
${rankInfo.xp_difference} XP to beat ${rankInfo.above_display_name}  ranked ${rankInfo.above_rank}.

RANK (monthly):  Coming Soon!
        `;
        // res.json(generateJSONSkeleton(formatMultilineStringToNormal(message),200));
        // for debug visualization
        res.json(generateJSONSkeleton(debugObj,200));
    }
    catch(err){
        if (!res.headersSent){
            if (err.message.includes("buoy_balance_cant_negative")){
                const HTTP_ERROR_CONFLICT = 409
                const message = "Oops this place has run out of fishes!";
                res.status(HTTP_ERROR_CONFLICT).json(generateJSONSkeleton(message,HTTP_ERROR_CONFLICT))
            }
            else{
                handleDBError(err,res);
            }
        }
    }
});

router.put("buoy-handle", function(req,res){
    try{
        const sql = "";
        const stmt = db.prepare();
    }
    catch(err){

    }
});
// other than the already defined routes
router.all('*', function(_,res){
    res.status(404)
        .json(generateJSONSkeleton("You are accessing page that does not exist!",404));
});

process.on('SIGINT', () => {
    db.close();
    server.close();
});

module.exports = router;