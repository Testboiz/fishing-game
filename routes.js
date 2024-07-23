/** @format */

const db = require("better-sqlite3")("./fish-hunt.db");
const express = require("express");
const middlewares = require("./middlewares");
const redis = require("redis");
const router = express.Router();
const myUtils = require("./utils");

db.pragma("journal_mode = WAL");
const client = redis.createClient();
client.connect().then();

// Helper function to handle the complexity of multiline string handling
function generateResponseString(fishCaught, wormInfo, rankInfo) {
    var strArray = [
        `
Small Worms: ${wormInfo.small_worms}
Tasty Worms: ${wormInfo.tasty_worms}
Enchanted Worms: ${wormInfo.enchanted_worms}
Magic Worms: ${wormInfo.magic_worms}
Gold : Coming Soon!

        `,
        `
You caught ${fishCaught.fish_name}
Fishing Exp: ${rankInfo.xp} (+1)
Fish: Coming Soon!
Your Earnings: ${rankInfo.linden_balance} L$ (+${fishCaught.fish_value}) 
Rank Extras!: Coming Soon!
Kingdoms Coming Soon! 

        `,
        `
Rank (overall):  ${rankInfo.rank}        
        `,
        rankInfo.rank === "1" // Note : its string
            ? `${rankInfo.xp_difference} XP to beat ${rankInfo.above_display_name}  ranked ${rankInfo.above_rank}.`
            : `You are the top fisher!`,
        `\n`,
        `Rank (monthly):  Coming Soon!`,
    ];
    return strArray.join("\n");
}

function __setRedisCastCacheCallback(err, reply) {
    if (err) throw err;
    console.log(reply);
}

function setRedisCastCache(buoy_uuid, rod_uuid, worm_type) {
    // TODO: Implement boosts like Alacrity and shubbie
    const keyString = buoy_uuid.toString() + rod_uuid.toString();
    const SMALL_WORMS_TIMEOUT = 75;
    const TASTY_WORMS_TIMEOUT = 60;
    const ENCHANTED_WORMS_TIMEOUT = 45;
    const MAGIC_WORMS_TIMEOUT = 30;
    switch (worm_type) {
        case 1:
            client.setEx(
                keyString,
                SMALL_WORMS_TIMEOUT,
                "Small Worms",
                __setRedisCastCacheCallback
            );

            break;
        case 2:
            client.setEx(
                keyString,
                TASTY_WORMS_TIMEOUT,
                "Tasty Worms",
                __setRedisCastCacheCallback
            );
            break;
        case 3:
            client.setEx(
                keyString,
                ENCHANTED_WORMS_TIMEOUT,
                "Enchanted Worms",
                __setRedisCastCacheCallback
            );
            break;
        case 4:
            client.setEx(
                keyString,
                MAGIC_WORMS_TIMEOUT,
                "Magic Worms",
                __setRedisCastCacheCallback
            );
            break;
    }
}

router.get("/", function (_, res) {
    res.json(myUtils.generateJSONSkeleton("Server is up!", 200));
});

router.post("/rod", middlewares.playerRegisterMiddleware, function (req, res) {
    const params = {
        rod_uuid: req.query.rod_uuid,
        player_username: req.query.player_username
    };
    myUtils.ensureParametersOrValueNotNull(params);

    try {
        const sql = `
INSERT INTO rod_info 
(rod_uuid, small_worms, player_username)
VALUES
(?,100,?)
    `;
        const stmt = db.prepare(sql);
        stmt.run(params.rod_uuid, params.player_username);
    }
    catch (err) {
        myUtils.handleDBError(err, res);
    }
});

router.post("buoy", middlewares.playerRegisterMiddleware, function (req, res) {
    const buoy_uuid = req.params.buoy_uuid;
    myUtils.ensureParametersOrValueNotNull(buoy_uuid);
    try {
        const sql = `INSERT INTO buoy (buoy_uuid) VALUES (?)`;
        const stmt = db.prepare(sql);
        stmt.run(buoy_uuid);
    }
    catch (err) {
        myUtils.handleDBError(err, res);
    }
});

router.get("/auth", function (req, res) {
    const query =
        "SELECT * FROM rod_info WHERE rod_uuid = ? AND player_username = ?";
    const stmt = db.prepare(query);

    try {
        const params = {
            id: req.query.id,
            username: req.query.username,
        };

        myUtils.ensureParametersOrValueNotNull(params);

        // parameters can be immmediately puy on the function, making the code cleaner
        const result = stmt.get(params.id, params.username);
        var jsonOutput = {};

        if (result) {
            const HTTP_OK = 200;
            const msg =
                "Authorization Successful";
            jsonOutput = myUtils.generateJSONSkeleton(msg, HTTP_OK);
        } else {
            const HTTP_ERR_FORBIDDEN = 403;
            const msg =
                "Authorization Failed, Rod cannot be transferred to another player";
            jsonOutput = myUtils.generateJSONSkeleton(msg, HTTP_ERR_FORBIDDEN);
        }
        res.status(jsonOutput["status"]).json(jsonOutput);
    } catch (err) {
        myUtils.handleDBError(err, res);
    }
});

router.put("/cast", middlewares.timeoutMiddleware, middlewares.castMiddleware, function (req, res) {
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
SELECT small_worms, tasty_worms, enchanted_worms, magic_worms, selected_worm FROM rod_info WHERE rod_uuid = ?;
    `;
    const sqlForBuoys = `
UPDATE buoy 
    SET 
    buoy_balance = buoy_balance - ?,
    fishpot = fishpot +  ?
WHERE buoy_uuid = ?;
    `;
    const sqlForUpdateRank = `UPDATE rank_overall  SET xp = xp + ? WHERE player_username = ?; `;
    const sqlCastHandling = `
INSERT INTO buoy_casts (buoy_uuid, player_username, casts) VALUES (?,?,0)
    ON CONFLICT (buoy_uuid, player_username) DO UPDATE SET casts = casts + 1;
    `;

    const sqlUpdateAfterCast = `
UPDATE player 
SET 
    linden_balance = linden_balance + ?
    WHERE player_username = ?;
    `;
    try {
        const stmtFish = db.prepare(sqlForFish);
        const stmtRank = db.prepare(sqlForRank);
        const stmtWorm = db.prepare(sqlForWorms);
        const stmtWormInfo = db.prepare(sqlWormInfo);
        const stmtBuoy = db.prepare(sqlForBuoys);
        const stmtForUpdateRank = db.prepare(sqlForUpdateRank);
        const stmtCastHandling = db.prepare(sqlCastHandling);
        const stmtupdateAfterCast = db.prepare(sqlUpdateAfterCast);

        let fishCaught, wormInfo, rankInfo;

        const castTransaction = db.transaction(function () {
            stmtCastHandling.run(req.params.buoy_uuid, req.params.player_username);
            stmtWorm.run(req.params.rod_uuid);

            fishCaught = stmtFish.get(req.params.buoy_uuid);
            wormInfo = stmtWormInfo.get(req.params.rod_uuid);
            fish_value_multiplied = fishCaught.fish_value * fishCaught.multiplier;

            stmtBuoy.run(
                fish_value_multiplied,
                fish_value_multiplied * FISHPOT_RATE,
                req.params.buoy_uuid
            );

            stmtForUpdateRank.run(TEMP_XP, req.params.player_username);
            stmtupdateAfterCast.run(
                fish_value_multiplied,
                req.params.player_username
            );

            rankInfo = stmtRank.get(req.params.player_username);
        });

        castTransaction();
        setRedisCastCache(req.params.buoy_uuid, req.params.rod_uuid, wormInfo.selected_worm);

        const debugObj = {
            worms: {
                small: wormInfo.small_worms,
                tasty: wormInfo.tasty_worms,
                enchanted: wormInfo.enchanted_worms,
                magic: wormInfo.magic_worms,
            },
            fish: fishCaught.fish_name,
            xp: rankInfo.xp,
            debugCast: fishCaught.casts,
            earnings: {
                linden_balance: rankInfo.linden_balance,
                fish_value: fish_value_multiplied,
            },
            rank_info: {
                rank: rankInfo.rank,
                xp_difference: rankInfo.xp_difference,
                above_display_name: rankInfo.above_display_name,
                above_rank: rankInfo.above_rank,
            },
        };
        // res.json(myUtils.generateJSONSkeleton(generateResponseString(fishCaught,wormInfo,rankInfo),200));
        // for debug visualization
        res.json(myUtils.generateJSONSkeleton(debugObj, 200));
    } catch (err) {
        if (!res.headersSent) {
            if (err.message.includes("buoy_balance_cant_negative")) {
                const HTTP_ERROR_CONFLICT = 409;
                const message = "Oops this place has run out of fishes!";
                res
                    .status(HTTP_ERROR_CONFLICT)
                    .json(myUtils.generateJSONSkeleton(message, HTTP_ERROR_CONFLICT));
            } else {
                myUtils.handleDBError(err, res);
            }
        }
    }
});

// other than the already defined routes
router.all("*", function (_, res) {
    res
        .status(404)
        .json(
            myUtils.generateJSONSkeleton("You are accessing page that does not exist!", 404)
        );
});

process.on("SIGINT", () => {
    db.close();
});

module.exports = router;
