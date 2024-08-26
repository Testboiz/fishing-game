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
const CashoutStatus = require("./models/player-cashout");


const client = redis.createClient();
client.connect().then();

// Helper function to handle the complexity of multiline string handling
function generateResponseString(fishCaught, rodInfo, rankInfo, inventoryInfo) { // view
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
Your Earnings: ${rankInfo.balance} L$ (+${fishCaught.fish_value}) 
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
        (inventoryInfo.first) ? inventoryInfo.first.generateLotteryMessage() : "",
        (inventoryInfo.second) ? inventoryInfo.second.generateLotteryMessage() : "",
    ];
    return strArray.join("\n");
}

function __setRedisCastCacheCallback(err, reply) { // controller
    if (err) throw err;
    console.log(reply);
}

function setRedisCastCache(buoy_uuid, rod_uuid, worm_type, { // controller
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

function setWormType(worm_type) {  // ??
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

function updateAfterCast(req, fish_value_multiplied, rod_type, res) {  // controller, may not be needed
    const inventoryInfo = {}, xpTriggers = {}, inventoryObject = {};

    try {
        const inventory = Inventory.fromDB(req.params.player_username);
        const balance = Cashout.fromDB(req.params.player_username);
        const player = Player.fromDB(req.params.player_username);
        const rod = Rod.fromDB(req.params.rod_uuid);

        const firstLottery = new FishLottery();
        const secondLottery = new FishLottery();

        inventoryInfo.first = firstLottery;
        inventoryInfo.second = secondLottery;

        inventory.addGold(1);
        inventory.addFish(1);

        switch (firstLottery) {
            case "worm":
                rod.addLotteryWorms();
                inventoryInfo.first = setWormType(req.params.worm_type);
                break;
            case "alacrity":
                if (rod_type > CONSTANTS.ENUMS.ROD.ENCHANTED) {
                    rod.add_alacrity_charges(5);
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
                rod.addLotteryWorms();
                inventoryInfo.second = setWormType(req.params.worm_type);
                break;
            case "alacrity":
                if (rod_type > CONSTANTS.ENUMS.ROD.ENCHANTED) {
                    rod.add_alacrity_charges(5);
                }
                break;
            case "powder":
                inventory.addPowder(1);
                break;
            case "xp":
                xpTriggers.second = true;
                break;
        }

        const updateAfterCastTransaction = db.transaction(function () {
            player.addXP(rod.computeXP(xpTriggers));
            balance.addBalance(fish_value_multiplied);
            rod.updateToDB();
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

router.get("/", function (_, res) {
    res.json(myUtils.generateJSONSkeleton("Server is up!"));
});

router.post("/rod/register", middlewares.playerRegisterMiddleware, function (req, res) {
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
        const newRod = new Rod({
            rod_uuid: params.rod_uuid,
            small_worms: 100, // move to constants
            player_username: params.player_username,
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
        }
        rod.updateToDB();
        let msg = `You have bought ${params.worm_amnount} ${params.worm_type.replace("_", " ")} `;
        const responseJSON = myUtils.generateJSONSkeleton(msg);
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
    const player_username = req.query.player_username;

    try {
        myUtils.ensureParametersOrValueNotNull(player_username);

        const playerCashout = Cashout.fromDB(player_username);
        const cashoutInfo = playerCashout.cashout();

        if (cashoutInfo instanceof CashoutStatus.NoBalance) {
            const msgNoBalance = `You need at least 1L$ to cashout \n You had ${cashoutInfo.residualBalance} L$`;
            res.status(CONSTANTS.HTTP.CONFLICT).json(myUtils.generateJSONSkeleton(msgNoBalance, CONSTANTS.HTTP.CONFLICT));
        }
        else if (cashoutInfo instanceof CashoutStatus.OutOfQuota) {
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
        player_username: req.query.player_username,
    };

    try {
        myUtils.ensureParametersOrValueNotNull(params);

        const rodToAuth = Rod.fromDB(params.rod_uuid);
        const authStatus = rodToAuth.authenticate(params.player_username);
        var jsonOutput = {};

        if (authStatus) {
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
    try {
        const player = Player.fromDB(req.params.player_username);
        const rod = Rod.fromDB(req.params.rod_uuid);
        const buoy = Buoy.fromDB(req.params.buoy_uuid);

        let fishCaught, rodInfo, rankInfo, buoyInfo, inventoryInfo;
        var alacrityEnabled = false;

        const castTransaction = db.transaction(function () {
            fishCaught = new Fish(req.params.buoy_uuid);
            rankInfo = player.getRankInfo(); // TODO : standardize
            rodInfo = Rod.cast(rod);
            buoyInfo = buoy.updateAfterCast(fishCaught.fish_value, req.params.player_username);

            if (rodInfo.alacrity_charges != 0) {
                alacrityEnabled = true;
            }

            req.params.worm_type = rodInfo.selected_worm;

            inventoryInfo = updateAfterCast(req, fishCaught.multipliedValue, rodInfo.rod_type, res);
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
        res.json(myUtils.generateJSONSkeleton(generateResponseString(fishCaught, rodInfo, rankInfo, inventoryInfo,)));
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
