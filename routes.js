/** @format */
const express = require("express");
const middlewares = require("./middlewares");
const redis = require("redis");
const router = express.Router();
const myUtils = require("./utils");

const db = require("./singletons/db");
const CONSTANTS = require("./singletons/constants");

const Inventory = require("./inventory");

const client = redis.createClient();
client.connect().then();


function generateLotteryMessage(lotteryType) {
    const lotteryMessage = "Fish Lottery:\n";
    switch (lotteryType) {
        case "alacrity":
            return lotteryMessage + "You've won 5 Alacrity charges (fast cast)\n";
        case "powder":
            return lotteryMessage + "You've won 2 Magic Powder (Shubbies Pet Food)!\n";
        case "xp":
            return lotteryMessage + "You've won 2 Fishing Experience\n";
        default:
            if (lotteryType.includes("Worms")) {
                return lotteryMessage + `You've won 2 ${lotteryType}!\n`;
            }
            else {
                return "\n";
            }
    }
}

// Helper function to handle the complexity of multiline string handling
function generateResponseString(fishCaught, rodInfo, rankInfo, inventoryInfo) {
    var strArray = [
        `
Small Worms: ${rodInfo.small_worms}
Tasty Worms: ${rodInfo.tasty_worms}
Enchanted Worms: ${rodInfo.enchanted_worms}
Magic Worms: ${rodInfo.magic_worms}
Gold : ${inventoryInfo.inventory._gold}

        `,
        (rodInfo.alacrity_charges != 0)
            ? `${rodInfo.alacrity_charges} Effects of Alacrity (speed cast)`
            : "",
        `
You caught ${fishCaught.fish_name}
Fishing Exp: ${rankInfo.xp} (+1)
Fish: ${inventoryInfo.inventory._fish}
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
        `Rank (monthly):  Coming Soon!\n`,
        (inventoryInfo.first) ? generateLotteryMessage(inventoryInfo.first) : "",
        (inventoryInfo.second) ? generateLotteryMessage(inventoryInfo.second) : "",
    ];
    return strArray.join("\n");
}

function calculateTax(res, buoy_uuid) {
    try {
        const stmt = db.prepare("SELECT buoy_color FROM buoy WHERE buoy_uuid = ?");
        const color = stmt.get(buoy_uuid);
        switch (color.buoy_color) {
            case "red":
                return 0.5;
            case "yellow":
                return 0.75;
            case "blue":
                return 0.85;
            default:
                throw new Error("Unidentified Buoy Color");
        }
    }
    catch (err) {
        myUtils.handleError(err, res);
    }
}

function __setRedisCastCacheCallback(err, reply) {
    if (err) throw err;
    console.log(reply);
}

function setRedisCastCache(buoy_uuid, rod_uuid, worm_type, {
    alacrity = false,
    shubbie = false,
    shubbieType = "blue"
} = {}) {
    const keyString = buoy_uuid.toString() + rod_uuid.toString();
    var timeMultiplier = 1;
    if (alacrity) {
        // alacrity is 15% speed boost
        timeMultiplier = timeMultiplier * CONSTANTS.TIME_BOOST_FACTOR.ALACRITY;
    }
    if (shubbie) {
        // TODO : properly implement after the shubbie table is made
        switch (shubbieType) {
            case "blue":
                timeMultiplier = timeMultiplier * CONSTANTS.TIME_BOOST_FACTOR.SHUBBIE.BLUE;
                break;
            case "green":
                timeMultiplier = timeMultiplier * CONSTANTS.TIME_BOOST_FACTOR.SHUBBIE.GREEN;
                break;
            case "red":
                timeMultiplier = timeMultiplier * CONSTANTS.TIME_BOOST_FACTOR.SHUBBIE.RED;
                break;
            default:
                throw new myUtils.BadRequestFormatError();
        }
    }
    switch (worm_type) {
        case 1:
            client.setEx(
                keyString,
                Math.round(CONSTANTS.TIMEOUT.SMALL_WORMS * timeMultiplier),
                "Small Worms",
                __setRedisCastCacheCallback
            );
            break;
        case 2:
            client.setEx(
                keyString,
                Math.round(CONSTANTS.TIMEOUT.TASTY_WORMS * timeMultiplier),
                "Tasty Worms",
                __setRedisCastCacheCallback
            );
            break;
        case 3:
            client.setEx(
                keyString,
                Math.round(CONSTANTS.TIMEOUT.ENCHANTED_WORMS * timeMultiplier),
                "Enchanted Worms",
                __setRedisCastCacheCallback
            );
            break;
        case 4:
            client.setEx(
                keyString,
                Math.round(CONSTANTS.TIMEOUT.MAGIC_WORMS * timeMultiplier),
                "Magic Worms",
                __setRedisCastCacheCallback
            );
            break;
        default:
            throw new myUtils.BadRequestFormatError();
    }
}

function runLottery(res) {
    try {
        const sql = `
SELECT name 
FROM fish_lottery 
WHERE probability < ? 
ORDER BY probability DESC 
LIMIT 1;
    `;
        const prob = Math.random();
        if (prob < CONSTANTS.FISH_LOTTERY_RATE) {
            const stmt = db.prepare(sql);
            let lotteryRow = stmt.get(prob);
            if (lotteryRow) {
                return lotteryRow.name;
            }
            else {
                return null;
            }
        }
        return null;
    }
    catch (err) {
        myUtils.handleError(err, res);
        return null;
    }
};

function getBaseXP(rod_type) {
    const ROD_TYPES = CONSTANTS.ENUMS.ROD;
    const BASE_XP = CONSTANTS.BASE_XP;
    switch (rod_type) {
        case ROD_TYPES.BEGINNER:
            return BASE_XP.BEGINNER;
        case ROD_TYPES.PRO:
            return BASE_XP.PRO;
        case ROD_TYPES.ENCHANTED:
            return BASE_XP.ENCHANTED;
        case ROD_TYPES.MACIC:
            return BASE_XP.MAGIC;
        case ROD_TYPES.SHARK:
            return BASE_XP.SHARK;
        case ROD_TYPES.COMP_1:
            return BASE_XP.COMP_1;
        case ROD_TYPES.COMP_2:
            return BASE_XP.COMP_2;
        default:
            throw new Error("Invalid Rod");
    }
}

function computeXP(xpLotteryTriggers, rod_type, res) {
    try {
        var eXP = getBaseXP(rod_type);
        const currentTime = new Date();
        const isWeekend = myUtils.isWeekend(currentTime);

        if (isWeekend) {
            eXP = eXP * 3;
        }
        if (xpLotteryTriggers.first) eXP += 2;
        if (xpLotteryTriggers.second) eXP += 2;
        return eXP;
    } catch (err) {
        myUtils.handleError(err, res);
        return null;
    }
}

function executeLotteries(stmtLottery, rod_uuid, shubbie_uuid) {
    for (const key in stmtLottery.inventory) {
        if (stmtLottery.inventory.hasOwnProperty(key)) {
            const item = stmtLottery.inventory[key];
            if (item && typeof item.run === 'function') {
                if (key) item.run(rod_uuid);
            }
        }
    }
    for (const key in stmtLottery.shubbie) {
        if (stmtLottery.inventory.hasOwnProperty(key)) {
            const item = stmtLottery.inventory[key];
            if (item && typeof item.run === 'function') {
                if (key) item.run(shubbie_uuid);
            }
        }
    }
}

function setWormType(worm_type) {
    switch (worm_type) {
        case 1:
            return "Small Worms";
        case 2:
            return "Tasty Worms";
        case 3:
            return "Enchanted Worms";
        case 4:
            return "Magic Worms";
        default:
            return "Undefined Worm Type";
    }
}

function updateAfterCast(req, fish_value_multiplied, rod_type, res) {
    const sqlUpdateAfterCast = `
UPDATE player 
SET 
    linden_balance = linden_balance + ?
    WHERE player_username = ?;
    `;
    const sqlForUpdateRank = `UPDATE rank_overall  SET xp = xp + ? WHERE player_username = ?; `;

    const inventoryInfo = {}, lotterySQL = {}, xpTriggers = {}, inventoryObject = {};
    const stmtLottery = {
        inventory: {},
        shubbie: {}
    };

    try {
        const inventory = Inventory.fromDB(req.params.player_username);

        const firstLottery = runLottery(res);
        const secondLottery = runLottery(res);

        inventoryInfo.first = firstLottery;
        inventoryInfo.second = secondLottery;

        const stmtupdateAfterCast = db.prepare(sqlUpdateAfterCast);
        const stmtForUpdateRank = db.prepare(sqlForUpdateRank);

        inventory.addGold(1);
        inventory.addFish(1);

        switch (firstLottery) {
            case "worm":
                lotterySQL.firstSQL = `
UPDATE rod_info
SET
    small_worms = CASE WHEN selected_worm = 1 THEN small_worms + 2 ELSE small_worms END,
    tasty_worms = CASE WHEN selected_worm = 2 THEN tasty_worms + 2 ELSE tasty_worms END,
    enchanted_worms = CASE WHEN selected_worm = 3 THEN enchanted_worms + 2 ELSE enchanted_worms END,
    magic_worms = CASE WHEN selected_worm = 4 THEN magic_worms + 2 ELSE magic_worms END
WHERE rod_uuid = ?
                    `;
                inventoryInfo.first = setWormType(req.params.worm_type);
                break;
            case "alacrity":
                if (rod_type > CONSTANTS.ENUMS.ROD.ENCHANTED) {
                    lotterySQL.firstSQL = `
UPDATE rod_info SET alacrity_charges = alacrity_charges + 5 WHERE rod_uuid = ?
                `;
                }
                break;
            case "powder":
                inventory.addPowder(1);
                break;
            case "xp":
                xpTriggers.first = true;
                break;
        }
        switch (secondLottery) {
            case "worm":
                lotterySQL.secondSQL = `
UPDATE rod_info
SET
    small_worms = CASE WHEN selected_worm = 1 THEN small_worms + 2 ELSE small_worms END,
    tasty_worms = CASE WHEN selected_worm = 2 THEN tasty_worms + 2 ELSE tasty_worms END,
    enchanted_worms = CASE WHEN selected_worm = 3 THEN enchanted_worms + 2 ELSE enchanted_worms END,
    magic_worms = CASE WHEN selected_worm = 4 THEN magic_worms + 2 ELSE magic_worms END
WHERE rod_uuid = ?
                    `;
                inventoryInfo.second = setWormType(req.params.worm_type);
                break;
            case "alacrity":
                if (rod_type > CONSTANTS.ENUMS.ROD.ENCHANTED) {
                    lotterySQL.secondSQL = `
UPDATE rod_info SET alacrity_charges = alacrity_charges + 5 WHERE rod_uuid = ?
                `;
                }
                break;
            case "powder":
                inventory.addPowder(1);
                break;
            case "xp":
                xpTriggers.second = true;
                break;
        }

        if (lotterySQL.firstSQL) stmtLottery.inventory.first = db.prepare(lotterySQL.firstSQL);
        if (lotterySQL.secondSQL) stmtLottery.inventory.second = db.prepare(lotterySQL.secondSQL);

        const updateAfterCastTransaction = db.transaction(function () {
            stmtForUpdateRank.run(
                computeXP(xpTriggers, rod_type, res),
                req.params.player_username
            );

            stmtupdateAfterCast.run(
                fish_value_multiplied,
                req.params.player_username
            );

            executeLotteries(stmtLottery, req.params.rod_uuid);

            inventory.updateDB();
        });
        updateAfterCastTransaction();

        Object.assign(inventoryObject, inventory);
        inventoryInfo.inventory = inventoryObject;

        return inventoryInfo;
    }
    catch (err) {
        throw err;
    }
}

function getCashoutInfo(player_username, res) {
    const sqlCashoutInfo = `
SELECT cashout.cashout_budget, cashout.last_major_cashout, player.linden_balance, cashout_values.cashout_value
FROM cashout 
INNER JOIN player ON cashout.player_username = player.player_username
INNER JOIN cashout_values ON cashout.cashout_type = cashout_values.cashout_type
WHERE cashout.player_username = ?
`;

    try {
        const cashoutInfo = db.prepare(sqlCashoutInfo).get(player_username);
        const balance = Number(cashoutInfo.linden_balance);
        const majorCashoutTime = myUtils.sqlToJSDateUTC(cashoutInfo.last_major_cashout);
        const cashoutBudget = Number(cashoutInfo.cashout_budget);
        const cashoutMaxValue = Number(cashoutInfo.cashout_value);
        const remainingTimeMs = myUtils.getRemainingMiliseconds(majorCashoutTime);
        const absoluteRemainingTime = Math.abs(remainingTimeMs);

        const isWithinADay = (absoluteRemainingTime < CONSTANTS.MILISECONDS_IN_DAY) ? true : false;

        return {
            balance: balance,
            budget: Math.min(Math.floor(balance), cashoutBudget),
            maxValue: cashoutMaxValue,
            isWithinADay: isWithinADay,
            remainingTimeMs: absoluteRemainingTime
        };
    }
    catch (err) {
        myUtils.handleError(err, res);
        return null;
    }
}

function resetCashout(player_username, res) {
    const sqlUpdatePlayerTableAfterCashout = `
    UPDATE player SET linden_balance = linden_balance - ? 
    WHERE player_username = ?`;
    const sqlUpdateCashoutTableAfterCashoutOverADay = `
UPDATE cashout
    SET
        cashout_budget = :cashout_max_value - :cashout_amnount,
        last_major_cashout = DATETIME('now')
    WHERE player_username = :username
    `;
    try {
        const stmtUpdateCashoutTableAfterCashoutOverADay = db.prepare(sqlUpdateCashoutTableAfterCashoutOverADay);
        const stmtUpdatePlayerTableAfterCashout = db.prepare(sqlUpdatePlayerTableAfterCashout);
        const cashoutInfo = getCashoutInfo(player_username, res);
        const cashoutAfterTimeLimit = db.transaction(function () {
            stmtUpdateCashoutTableAfterCashoutOverADay.run({
                "username": player_username,
                "cashout_amnount": cashoutInfo.budget,
                "cashout_max_value": cashoutInfo.maxValue
            });
            stmtUpdatePlayerTableAfterCashout.run(cashoutInfo.budget, player_username);
        });
        cashoutAfterTimeLimit();
    } catch (err) {
        myUtils.handleError(err, res);
    }
}

router.get("/", function (_, res) {
    res.json(myUtils.generateJSONSkeleton("Server is up!"));
});

router.post("/rod", middlewares.playerRegisterMiddleware, function (req, res) {
    const params = {
        rod_uuid: req.query.rod_uuid,
        player_username: req.query.player_username,
        player_display_name: req.query.player_display_name,
        rod_type: req.query.rod_type
    };
    myUtils.ensureParametersOrValueNotNull(params);
    const msg = "Player and rod registered with free 100 Small Worms";
    const responseJSON = myUtils.generateJSONSkeleton(msg);
    try {
        const sql = `
INSERT INTO rod_info 
(rod_uuid, small_worms, player_username,rod_type)
VALUES
(?,100,?,?)
    `;
        const stmt = db.prepare(sql);
        stmt.run(params.rod_uuid, params.player_username, params.rod_type);
        res.json(responseJSON);
    }
    catch (err) {
        if (err.message.includes("UNIQUE constraint failed")) {
            const errText = "Rod is already registered";
            const errMessage = myUtils.generateJSONSkeleton(errText, CONSTANTS.HTTP.CONFLICT);
            res.status(CONSTANTS.HTTP.CONFLICT).json(errMessage);
        }
        else {
            myUtils.handleError(err, res);
        }

    }
});

router.post("/rod/add-worms", function (req, res) {
    const params = {
        rod_uuid: req.query.rod_uuid,
        worm_amnount: Number(req.query.worm_amnount), // this has to be number to be able to increment and decrement
        worm_type: req.query.worm_type
    };
    try {
        myUtils.ensureParametersOrValueNotNull(params);
        let sql;
        switch (params.worm_type.toLowerCase()) {
            case "small_worms":
                sql = `UPDATE rod_info SET small_worms = small_worms + ? WHERE rod_uuid = ?`;
                break;
            case "tasty_worms":
                sql = `UPDATE rod_info SET tasty_worms = tasty_worms + ? WHERE rod_uuid = ?`;
                break;
            case "enchanted_worms":
                sql = `UPDATE rod_info SET enchanted_worms = enchanted_worms + ? WHERE rod_uuid = ?`;
                break;
            case "magic_worms":
                sql = `UPDATE rod_info SET magic_worms = magic_worms + ? WHERE rod_uuid = ?`;
                break;
        }
        stmt = db.prepare(sql);
        stmt.run(params.worm_amnount, params.rod_uuid);
        let msg = `You have bought ${params.worm_amnount} ${params.worm_type.replace("_", " ")} `;
        const responseJSON = myUtils.generateJSONSkeleton(msg);
        res.json(responseJSON);
    }
    catch (err) {
        myUtils.handleError(err, res);
    }
});

router.post("/buoy", middlewares.playerRegisterMiddleware, function (req, res) {
    const params = {
        buoy_uuid: req.query.buoy_uuid,
        buoy_color: req.query.buoy_color,
        player_username: req.query.player_username,
        player_display_name: req.query.player_display_name
    };
    const msg = "Buoy has been registered!";
    try {
        myUtils.ensureParametersOrValueNotNull(params);
        const sql = `INSERT INTO buoy (buoy_uuid, buoy_color) VALUES (?,?)`;
        const stmt = db.prepare(sql);
        stmt.run(params.buoy_uuid, params.buoy_color);
        res.json(myUtils.generateJSONSkeleton(msg));
    }
    catch (err) {
        if (err.message.includes("UNIQUE constraint failed")) {
            const errText = "Buoy is already registered";
            const errMessage = myUtils.generateJSONSkeleton(errText, CONSTANTS.HTTP.CONFLICT);
            res.status(CONSTANTS.HTTP.CONFLICT).json(errMessage);
        } else {
            myUtils.handleError(err, res);
        }
    }
});

router.post("/buoy/set-location-name", function (req, res) {
    const params = {
        buoy_uuid: req.query.buoy_uuid,
        location_name: req.query.location_name
    };
    const msg = "Buoy location set";
    try {
        myUtils.ensureParametersOrValueNotNull(params);
        const sql = `UPDATE buoy SET buoy_location_name = ? WHERE buoy_uuid = ?`;
        const stmt = db.prepare(sql);
        stmt.run(params.location_name, params.buoy_uuid);
        res.json(myUtils.generateJSONSkeleton(msg));
    }
    catch (err) {
        myUtils.handleError(err, res);
    }
});

router.post("/buoy/add-balance", function (req, res) {
    const params = {
        buoy_uuid: req.query.buoy_uuid,
        linden_amnount: Number(req.query.linden_amnount) // this has to be number
    };
    const msg = `Buoy balance added by ${params.linden_amnount} L$ (Tax Applied)`;
    try {
        myUtils.ensureParametersOrValueNotNull(params);
        const sql = `UPDATE buoy SET buoy_balance = buoy_balance + ? * ? WHERE buoy_uuid = ?`;
        const stmt = db.prepare(sql);
        const tax = calculateTax(res, params.buoy_uuid);
        stmt.run(params.linden_amnount, tax, params.buoy_uuid);
        res.json(myUtils.generateJSONSkeleton(msg));
    }
    catch (err) {
        myUtils.handleError(err, res);
    }
});

router.post("/cashout", function (req, res) {
    const player_username = req.query.player_username;
    const sqlUpdateCashoutTableAfterCashoutWithinADay = `
UPDATE cashout
    SET
    cashout_budget = cashout.cashout_budget - :cashout_amnount,
    last_major_cashout =
        CASE
            WHEN cashout.cashout_budget - :cashout_amnount = 0
            THEN DATETIME('now')
            ELSE last_major_cashout
        END
    WHERE cashout.player_username = :username
    `;
    const sqlUpdatePlayerTableAfterCashout = `
    UPDATE player SET linden_balance = linden_balance - ? 
    WHERE player_username = ?`;
    const sqlUpdateCashoutTableAfterCashoutOverADay = `
UPDATE cashout
    SET
        cashout_budget = :cashout_max_value - :cashout_amnount,
        last_major_cashout = DATETIME('now')
    WHERE player_username = :username
    `; // this would also reset the budget to the initial value
    try {
        myUtils.ensureParametersOrValueNotNull(player_username);
        const cashoutInfo = getCashoutInfo(player_username, res);
        const stmtUpdateCashoutTableAfterCashoutWithinADay = db.prepare(sqlUpdateCashoutTableAfterCashoutWithinADay);
        const stmtUpdateCashoutTableAfterCashoutOverADay = db.prepare(sqlUpdateCashoutTableAfterCashoutOverADay);
        const stmtUpdatePlayerTableAfterCashout = db.prepare(sqlUpdatePlayerTableAfterCashout);

        const roundedBalance = myUtils.roundToFixed(cashoutInfo.budget);
        if (Math.floor(cashoutInfo.balance) === 0) {
            const msgNoBalance = `You need at least 1L$ to cashout \n You had ${roundedBalance} L$`;
            res.status(CONSTANTS.HTTP.CONFLICT).json(myUtils.generateJSONSkeleton(msgNoBalance, CONSTANTS.HTTP.CONFLICT));
        }
        else if (cashoutInfo.budget === 0) {
            if (cashoutInfo.isWithinADay) {
                const remainingMs = cashoutInfo.remainingTimeMs;
                const hh_mm_ss = myUtils.getHHMMSSFromMiliseconds(remainingMs);
                const msgLimit = `You have reached the cashout limit for today, you can cashout again in ${hh_mm_ss}`;
                res.status(CONSTANTS.HTTP.CONFLICT).json(myUtils.generateJSONSkeleton(msgLimit, CONSTANTS.HTTP.CONFLICT));
            }
            else {
                let updatedInfo;
                const updateAndCashout = db.transaction(function () {
                    resetCashout(player_username, res);
                    updatedInfo = getCashoutInfo(player_username, res);
                    stmtUpdateCashoutTableAfterCashoutOverADay.run({
                        "username": player_username,
                        "cashout_amnount": updatedInfo.budget,
                        "cashout_max_value": updatedInfo.maxValue
                    });
                    stmtUpdatePlayerTableAfterCashout.run(updatedInfo.budget, player_username);
                });
                updateAndCashout();
                const updatedRoundedBalance = myUtils.roundToFixed(updatedInfo.balance);
                const msg = `Congratulations! You have cashed out ${updatedRoundedBalance} L$ `;
                res.json(myUtils.generateJSONSkeleton(msg));
            }
        }
        else {
            const msg = `Congratulations! You have cashed out ${roundedBalance} L$`;
            const cashoutWithinADay = db.transaction(function () {
                stmtUpdateCashoutTableAfterCashoutWithinADay.run({
                    "username": player_username,
                    "cashout_amnount": cashoutInfo.budget
                });
                stmtUpdatePlayerTableAfterCashout.run(cashoutInfo.budget, player_username);
            });
            const cashoutAfterTimeLimit = db.transaction(function () {
                stmtUpdateCashoutTableAfterCashoutOverADay.run({
                    "username": player_username,
                    "cashout_amnount": cashoutInfo.budget,
                    "cashout_max_value": cashoutInfo.maxValue
                });
                stmtUpdatePlayerTableAfterCashout.run(cashoutInfo.budget, player_username);
            });
            if (cashoutInfo.isWithinADay) {
                cashoutWithinADay();
            }
            else {
                cashoutAfterTimeLimit();
            }
            res.json(myUtils.generateJSONSkeleton(msg));
        }
    }
    catch (err) {
        myUtils.handleError(err, res);
    }
});

router.get("/auth", function (req, res) {
    const query =
        "SELECT * FROM rod_info WHERE rod_uuid = ? AND player_username = ?";
    const params = {
        rod_uuid: req.query.rod_uuid,
        player_username: req.query.player_username,
    };

    try {
        const stmt = db.prepare(query);
        myUtils.ensureParametersOrValueNotNull(params);

        // parameters can be immmediately puy on the function, making the code cleaner
        const result = stmt.get(params.rod_uuid, params.player_username);
        var jsonOutput = {};

        if (result) {
            const msg = "Authorization Successful";
            jsonOutput = myUtils.generateJSONSkeleton(msg);
        }
        else {
            const msg = "Authorization Failed, Rod cannot be transferred to another player";
            jsonOutput = myUtils.generateJSONSkeleton(msg, CONSTANTS.HTTP.FORBIDDEN);
        }
        res.status(jsonOutput["status"]).json(jsonOutput);
    }
    catch (err) {
        myUtils.handleError(err, res);
    }
});

router.put("/cast", middlewares.timeoutMiddleware, middlewares.castMiddleware, middlewares.fishpotMiddleware, function (req, res) {
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
    magic_worms = CASE WHEN selected_worm = 4 THEN magic_worms - 1 ELSE magic_worms END,
    alacrity_charges = CASE WHEN alacrity_charges > 0 THEN alacrity_charges - 1 ELSE alacrity_charges END
WHERE rod_uuid = ?;
    `;
    const sqlRodInfo = `
    SELECT 
        small_worms, 
        tasty_worms, 
        enchanted_worms, 
        magic_worms, 
        selected_worm, 
        alacrity_charges,
        rod_type
    FROM 
        rod_info 
    WHERE 
        rod_uuid = ?;
        `;
    const sqlForBuoys = `
UPDATE buoy 
    SET 
    buoy_balance = buoy_balance - ?,
    fishpot = fishpot +  ?
WHERE buoy_uuid = ?;
    `;
    const sqlCastHandling = `
INSERT INTO buoy_casts (buoy_uuid, player_username, casts) VALUES (?,?,0)
    ON CONFLICT (buoy_uuid, player_username) DO UPDATE SET casts = casts + 1;
    `;


    try {
        const stmtFish = db.prepare(sqlForFish);
        const stmtRank = db.prepare(sqlForRank);
        const stmtWorm = db.prepare(sqlForWorms);
        const stmtRodInfo = db.prepare(sqlRodInfo);
        const stmtBuoy = db.prepare(sqlForBuoys);
        const stmtCastHandling = db.prepare(sqlCastHandling);

        let fishCaught, rodInfo, rankInfo, fish_value_multiplied, inventoryInfo;
        var alacrityEnabled = false;

        const castTransaction = db.transaction(function () {
            stmtCastHandling.run(req.params.buoy_uuid, req.params.player_username);
            stmtWorm.run(req.params.rod_uuid);

            fishCaught = stmtFish.get(req.params.buoy_uuid);
            rodInfo = stmtRodInfo.get(req.params.rod_uuid);
            fish_value_multiplied = fishCaught.fish_value * fishCaught.multiplier;
            const fishpot_value = fish_value_multiplied * CONSTANTS.FISHPOT_RATE;

            if (rodInfo.alacrity_charges != 0) {
                alacrityEnabled = true;
            }

            stmtBuoy.run(
                fish_value_multiplied,
                fishpot_value,
                req.params.buoy_uuid
            );

            req.params.worm_type = rodInfo.selected_worm;

            inventoryInfo = updateAfterCast(req, fish_value_multiplied, rodInfo.rod_type, res);
            rankInfo = stmtRank.get(req.params.player_username);
        });
        castTransaction();
        setRedisCastCache(
            req.params.buoy_uuid,
            req.params.rod_uuid,
            req.params.worm_type,
            { alacrity: alacrityEnabled }
        );
        const debugObj = {
            worms: {
                small: rodInfo.small_worms,
                tasty: rodInfo.tasty_worms,
                enchanted: rodInfo.enchanted_worms,
                magic: rodInfo.magic_worms,
            },
            gold: inventoryInfo.inventory._gold,
            fish: fishCaught.fish_name,
            xp: rankInfo.xp,
            alacrity: rodInfo.alacrity_charges,
            powder: inventoryInfo.inventory._powder,
            fish: inventoryInfo.inventory._fish,
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
        res.json(myUtils.generateJSONSkeleton(generateResponseString(fishCaught, rodInfo, rankInfo, inventoryInfo)));
        // for debug visualization
        // res.json(myUtils.generateJSONSkeleton(debugObj));
    } catch (err) {
        if (!res.headersSent) {
            if (err.message.includes("buoy_balance_cant_negative")) {
                const message = "Oops this place has run out of fishes!";
                res
                    .status(CONSTANTS.HTTP.CONFLICT)
                    .json(myUtils.generateJSONSkeleton(message, CONSTANTS.HTTP.CONFLICT));
            } else {
                myUtils.handleError(err, res);
            }
        }
    }
});

// other than the already defined routes
router.all("*", function (_, res) {
    const errMessage = "You are accessing page that does not exist!";
    res
        .status(CONSTANTS.HTTP.NOT_FOUND)
        .json(
            myUtils.generateJSONSkeleton(errMessage, CONSTANTS.HTTP.NOT_FOUND)
        );
});

process.on("SIGINT", () => {
    db.close();
});

module.exports = router;
