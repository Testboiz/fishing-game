const express = require('express');
const router = express.Router();
const db = require('better-sqlite3')('./fish-hunt.db');
db.pragma('journal_mode = WAL');

// default handling of error
function handleDBError(err, res){
    jsonOutput = {
        message : "the database blew up",
        status : 500
    };
    res.status(jsonOutput["status"]).json(jsonOutput);
}

// generate standardized structure of json
function generateJSONSkeleton(objectOrMessage, httpCode){
    return {
        message : objectOrMessage,
        status : httpCode
    };
}

router.get("/", function(_, res){
    res.json(generateJSONSkeleton("Server is up!", 200));
});


router.get("/auth", function(req,res){
    const query = "SELECT * FROM rod_info WHERE rod_uuid = ? AND player_username = ?";
    const stmt = db.prepare(query);

    try{
        // parameters can be immmediately puy on the function, making the code cleaner
        const result = stmt.get(req.query.id,req.query.username);
        var jsonOutput = {}

        if (result){
            const httpCode = 200;
            const msg = "Authorization Failed, Rod cannot be transferred to another player";
            jsonOutput = generateJSONSkeleton(msg, httpCode);
        }
        else{
            const httpCode = 403;
            const msg = "Authorization Failed, Rod cannot be transferred to another player";
            jsonOutput = generateJSONSkeleton(msg, httpCode);
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

router.put("/buoy/connect", function(req,res){
    try{
        const query = "UPDATE rod_info SET selected_buoy = ?";
        const buoy_id = req.query.buoyID;
        const stmt = db.prepare(query);
        stmt.run(buoy_id); 
    }
    catch (err){
        handleDBError(err,res);
    }
});



router.put("buoy/cast", function(req, res){
    const sqlForFish = `
WITH probability AS (
    SELECT ABS(RANDOM() / CAST(-9223372036854775808 AS REAL)) AS probability
)
SELECT f.fish_name, f.fish_value, c.casts FROM fish AS f, probability AS pr, fish_probability AS p, buoy_casts AS c
    JOIN fish_probability ON (f.fish_probability_class = p.probability_class)
    JOIN probability ON pr.probability < p.probability_value OR f.fish_probability_class = "Common"
    JOIN buoy_casts ON c.buoy_uuid = ? AND c.player_username = ?
    WHERE (pr.probability < p.probability_value OR f.fish_probability_class = "Common") 
    ORDER BY RANDOM()
    LIMIT 1       
;
`;
    const sqlForRank = `
WITH ranked_fishers AS (
SELECT
    player_username,
    player_display_name,
    xp,
    RANK() OVER (ORDER BY xp DESC) AS rank
FROM
    rank_overall
)
SELECT
    ro1.player_username,
    ro1.player_display_name,
    ro1.xp,
    ro1.rank,
    ro2.player_display_name AS above_display_name,
    ro2.xp - ro1.xp AS xp_difference,
    ro2.rank AS above_rank
FROM
    ranked_fishers ro1
LEFT JOIN 
    ranked_fishers ro2 ON ro1.rank = ro2.rank + 1
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
    const sqlForBuoys = `
UPDATE buoy 
    SET 
    buoy_balance = buoy_balance - ?,
    fishpot = fishpot +  ? * 0.01
WHERE buoy_uuid = ?;
    `;
    const sqlCastHandling = `
INSERT INTO buoy_casts (buoy_uuid, player_username, casts) VALUES (?,?,0)
    ON CONFLICT (buoy_uuid, player_username) DO UPDATE SET casts = casts + 1;
    `;

    const sqlUpdateAfterCast = `
UPDATE player 
SET 
    xp = xp + ?,
    linden_balance = linden_balance + ?
    WHERE player_username = ?;
    `
    try{
        const player_username = req.query.player_username;
        const buoy_uuid = req.query.buoy_uuid;
        const rod_uuid = req.query.rod_uuid;

        const stmtFish = db.prepare(sqlForFish);
        const stmtRank = db.prepare(sqlForRank);
        const stmtWorm = db.prepare(sqlForWorms);
        const stmtBuoy = db.prepare(sqlForBuoys);
        const stmtCastHandling = db.prepare(sqlCastHandling);
        const stmtupdateAfterCast = db.prepare(sqlUpdateAfterCast);

        stmtCastHandling.run(buoy_uuid,player_username);
        stmtWorm.run(rod_uuid);
        
        // TODO handle spook
        const fishCaught = stmtFish.get();
        const rankInfo = stmtRank.get(player_username);

        // if error, buoy empty
        stmtBuoy.run()

        stmtupdateAfterCast.run()

        var message = "";
        res.json(generateJSONSkeleton(message,200));
    }
    catch(err){
        // TODO handle empty buoy here
        handleDBError(err,res)
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