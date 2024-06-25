const { json } = require('docker/src/languages');
const express = require('express');
const sqlite = require('sqlite3');
const router = express.Router();
// const db = new sqlite.Database('./fish-hunt.db');
const db = require('better-sqlite3')('./fish-hunt.db')

function handleDBError(err, res){
    jsonOutput = {
        message : "the database blew up",
        status : 500
    };
    res.status(jsonOutput["status"]).json(jsonOutput);
}

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
            generateJSONSkeleton(msg, httpCode);
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