/** @format */
const express = require("express");
const middlewares = require("./middlewares");
const redis = require("redis");
const router = express.Router();
const myUtils = require("./utils");

const db = require("./singletons/db");
const CONSTANTS = require("./singletons/constants");

const Inventory = require("./models/inventory");
const Rod = require("./models/rod");
const Buoy = require("./models/buoy");
const Cashout = require("./models/player-cashout");
const Fish = require("./models/fish");
const Player = require("./models/player");
const FishLottery = require("./models/lottery");
const { NoBalance, OutOfQuota } = require("./models/cashout-status");


const client = redis.createClient();
client.connect().then();

/**
 * A View function that generates the fishing response string for the HTTP response
 * @param {object} fishCaught The result set of the fish that is caught 
 * @param {object} rodInfo The result set of the rod from the player
 * @param {object} rankInfo The result set of the information of the rank of the player
 * @param {object} inventoryInfo The result set of the information of the player's inventory
 * @param {object} lotteryInfo The result set of the fish lottery winnings (if any) of the player
 * @return {string} The formatted message ready to be sent as a response
 */
function generateResponseString(fishCaught, rodInfo, rankInfo, inventoryInfo, lotteryInfo) { // view
    var strArray = [
        `
Small Worms: ${rodInfo.small_worms}
Tasty Worms: ${rodInfo.tasty_worms}
Enchanted Worms: ${rodInfo.enchanted_worms}
Magic Worms: ${rodInfo.magic_worms}
Gold : ${inventoryInfo.gold}

        `,
        (rodInfo.alacrity_charges != 0)
            ? `${rodInfo.alacrity_charges} Effects of Alacrity (speed cast)`
            : "",
        `
You caught ${fishCaught.fish_name}
Fishing Exp: ${rankInfo.xp} (+1)
Fish: ${inventoryInfo.fish}
Your Earnings: ${myUtils.roundToFixed(rankInfo.balance)} L$ (+${fishCaught.fish_value}) 
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
        (lotteryInfo[0]) ? lotteryInfo[0].generateLotteryMessage(rodInfo.rod_uuid) : "",
        (lotteryInfo[1]) ? lotteryInfo[1].generateLotteryMessage(rodInfo.rod_uuid) : "",
    ];
    return strArray.join("\n");
}

/**
 * Callback function for `setRedisCastCashe()`
 * @param {Error} err the error object to be handled elsewhere
 * @param {*} reply the object to be replied
 */
function __setRedisCastCacheCallback(err, reply) {
    if (err) throw err;
    console.log(reply);
}


/**
 * Sets the cast cache and its timeout to set limits on casting speed
 * @param {string} buoy_uuid the unique uuid of the buoy that the player is fishing on
 * @param {string} rod_uuid the unique uuid of the rod owned by the player
 * @param {number} worm_type the selected worm that is used by the worm
 * @param {boolean} Object.alacrity indicator of the player having consumed alacrity potion
 * @param {boolean} Object.shubbie indicator if player has shubbie
 * @param {string} Object.shubbieType Type (rarity) of the shubbie
 */
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
    let timeoutValue, wormName;
    switch (worm_type) {
        case 1:
            timeoutValue = Math.round(CONSTANTS.TIMEOUT.SMALL_WORMS * timeMultiplier);
            wormName = "Small Worms";
            break;
        case 2:
            timeoutValue = Math.round(CONSTANTS.TIMEOUT.TASTY_WORMS * timeMultiplier);
            wormName = "Tasty Worms";
            break;
        case 3:
            timeoutValue = Math.round(CONSTANTS.TIMEOUT.ENCHANTED_WORMS * timeMultiplier);
            wormName = "Enchanted Worms";
            break;
        case 4:
            timeoutValue = Math.round(CONSTANTS.TIMEOUT.MAGIC_WORMS * timeMultiplier);
            wormName = "Magic Worms";
            break;
        default:
            throw new myUtils.BadRequestFormatError();
    }
    try {
        client.setEx(
            keyString,
            timeoutValue,
            wormName,
            __setRedisCastCacheCallback
        );
    } catch (err) {
        throw err;
    }
}


/**
 * Processes the winnings (if any) of the fish lotteries
 * @param {Array<Inventory>} lotteryInfo the winnings of the fish lottery
 * @param {Rod} Rod the Rod Object that has casted the lottery
 * @param {Inventory} Inventory the Inventory object of the player
 * @param {Array<boolean>} xpTriggers the triggers from earning XP lotteries for later computation
 */
function handleLotteries(lotteryInfo, Rod, Inventory, xpTriggers) {
    try {
        for (var i = 0; i < lotteryInfo.length; i++) {
            switch (lotteryInfo[i].name) {
                case "worm":
                    Rod.addLotteryWorms();
                    break;
                case "alacrity":
                    if (rod_type > CONSTANTS.ENUMS.ROD.ENCHANTED) {
                        Rod.add_alacrity_charges(5);
                    }
                    break;
                case "powder":
                    Inventory.addPowder(1);
                    break;
                case "xp":
                    xpTriggers.push(true);
                    break;
            }
        }
    } catch (err) {
        throw err;
    }
}

router.get("/", function (_, res) {
    try {
        res.json(myUtils.generateJSONSkeleton("Server is up!"));
    } catch (err) {
        myUtils.handleError(err, res);
    }
});

router.post("/rod/register", middlewares.playerRegisterMiddleware, function (req, res) {
    const params = {
        rod_uuid: req.query.rod_uuid,
        player_uuid: req.query.player_uuid,
        player_username: req.query.player_username,
        player_display_name: req.query.player_display_name,
        rod_type: req.query.rod_type
    };
    myUtils.ensureParametersOrValueNotNull(params);
    const msg = "Player and rod registered with free 100 Small Worms";
    const responseJSON = myUtils.generateJSONSkeleton(msg);
    try {
        const newRod = new Rod({
            rod_uuid: params.rod_uuid,
            small_worms: CONSTANTS.STARTER_WORMS,
            player_uuid: params.player_uuid,
            rod_type: params.rod_type
        });
        newRod.addToDB();
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
        const rod = Rod.fromDB(params.rod_uuid);
        switch (params.worm_type.toLowerCase()) {
            case "small_worms":
                rod.add_small_worms(params.worm_amnount);
                break;
            case "tasty_worms":
                rod.add_tasty_worms(params.worm_amnount);
                break;
            case "enchanted_worms":
                rod.add_enchanted_worms(params.worm_amnount);
                break;
            case "magic_worms":
                rod.add_magic_worms(params.worm_amnount);
                break;
            default:
                throw new Error("Invalid Worm Type");
        }
        rod.updateToDB();
        let msg = `You have bought ${params.worm_amnount} ${params.worm_type.replace("_", " ")} `;
        let worms = params.worm_amnount;
        const obj = {
            text: msg,
            wormCount: worms
        };
        const responseJSON = myUtils.generateJSONSkeleton(obj);
        res.json(responseJSON);
    }
    catch (err) {
        myUtils.handleError(err, res);
    }
});

router.post("/buoy/register", middlewares.playerRegisterMiddleware, function (req, res) {
    const params = {
        buoy_uuid: req.query.buoy_uuid,
        buoy_color: req.query.buoy_color,
        player_uuid: req.query.player_uuid,
        player_username: req.query.player_username,
        player_display_name: req.query.player_display_name
    };
    const msg = "Buoy has been registered!";
    try {
        myUtils.ensureParametersOrValueNotNull(params);
        const newBuoy = new Buoy({ buoy_uuid: params.buoy_uuid, buoy_color: params.buoy_color });
        newBuoy.addToDB();
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
        const buoy = Buoy.fromDB(params.buoy_uuid);
        buoy.buoy_location_name = params.location_name;

        buoy.updateToDB();
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
        const buoy = Buoy.fromDB(params.buoy_uuid);
        buoy.addBalance(params.linden_amnount);
        buoy.updateToDB();
        res.json(myUtils.generateJSONSkeleton(msg));
    }
    catch (err) {
        myUtils.handleError(err, res);
    }
});

router.post("/cashout", function (req, res) {
    const player_uuid = req.query.player_uuid;

    try {
        myUtils.ensureParametersOrValueNotNull(player_uuid);

        const playerCashout = Cashout.fromDB(player_uuid);
        const cashoutInfo = playerCashout.cashout();
        if (cashoutInfo instanceof NoBalance) {
            const msgNoBalance = `You need at least 1L$ to cashout \n You had ${cashoutInfo.residualBalance} L$`;
            res.status(CONSTANTS.HTTP.CONFLICT).json(myUtils.generateJSONSkeleton(msgNoBalance, CONSTANTS.HTTP.CONFLICT));
        }
        else if (cashoutInfo instanceof OutOfQuota) {
            const msgLimit = `You have reached the cashout limit for today, you can cashout again in ${cashoutInfo.remainingTime}`;
            res.status(CONSTANTS.HTTP.CONFLICT).json(myUtils.generateJSONSkeleton(msgLimit, CONSTANTS.HTTP.CONFLICT));
        }
        else {
            const msg = `Congratulations! You have cashed out ${cashoutInfo.balanceTaken} L$, You have ${cashoutInfo.remainingBalance} L$ left`;
            res.json(myUtils.generateJSONSkeleton(msg));
        }
    }
    catch (err) {
        myUtils.handleError(err, res);
    }
});

router.get("/rod/auth", function (req, res) {
    const params = {
        rod_uuid: req.query.rod_uuid,
        player_uuid: req.query.player_uuid,
    };

    try {
        myUtils.ensureParametersOrValueNotNull(params);

        const rodToAuth = Rod.fromDB(params.rod_uuid);
        const authStatus = rodToAuth.authenticate(params.player_uuid);

        let msg;
        if (authStatus) {
            msg = "Authorization Successful";
            res.json(myUtils.generateJSONSkeleton(msg));
        }
        else {
            msg = "Authorization Failed, Rod cannot be transferred to another player";
            res.json(myUtils.generateJSONSkeleton(msg, CONSTANTS.HTTP.FORBIDDEN));
        }
    }
    catch (err) {
        myUtils.handleError(err, res);
    }
});

router.put("/cast", middlewares.timeoutMiddleware, middlewares.castMiddleware, middlewares.fishpotMiddleware, function (req, res) {
    try {
        const player = Player.fromDB(req.params.player_uuid);
        const rod = Rod.fromDB(req.params.rod_uuid);
        const buoy = Buoy.fromDB(req.params.buoy_uuid);
        const inventory = Inventory.fromDB(req.params.player_uuid);
        const balance = Cashout.fromDB(req.params.player_uuid);

        const lotteryInfo = [], xpTriggers = [];
        let fishCaught, rodInfo, rankInfo, inventoryInfo;
        var alacrityEnabled = false;

        lotteryInfo.push(new FishLottery());
        lotteryInfo.push(new FishLottery());

        inventory.addGold(1);
        inventory.addFish(1);

        handleLotteries(lotteryInfo, rod, inventory, xpTriggers);

        const castTransaction = db.transaction(function () {
            fishCaught = new Fish(req.params.buoy_uuid);
            rankInfo = player.getRankInfo();
            rodInfo = Rod.cast(rod);
            buoy.updateAfterCast(fishCaught.fish_value, req.params.player_uuid);

            player.addXP(rod.computeXP(xpTriggers));
            balance.addBalance(fishCaught.multipliedValue);
            rodInfo.updateToDB();
            inventory.updateDB();
        });
        castTransaction();
        if (rodInfo.alacrity_charges != 0) {
            alacrityEnabled = true;
        }

        req.params.worm_type = rodInfo.selected_worm;
        inventoryInfo = inventory.toObject();

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
            gold: inventoryInfo.gold,
            fish: fishCaught.fish_name,
            xp: rankInfo.xp,
            alacrity: rodInfo.alacrity_charges,
            powder: inventoryInfo.powder,
            fish: inventoryInfo.fish,
            debugCast: fishCaught.casts,
            earnings: {
                balance: rankInfo.balance,
                fish_value: fishCaught.multipliedValue,
            },
            rank_info: {
                rank: rankInfo.rank,
                xp_difference: rankInfo.xp_difference,
                above_display_name: rankInfo.above_display_name,
                above_rank: rankInfo.above_rank,
            },
        };
        res.json(myUtils.generateJSONSkeleton(generateResponseString(fishCaught, rodInfo, rankInfo, inventoryInfo, lotteryInfo)));
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
