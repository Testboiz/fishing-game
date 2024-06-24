const { json } = require('docker/src/languages');
const express = require('express');
const sqlite = require('sqlite3');
const router = express.Router();
const db = new sqlite.Database('./fish-hunt.db');
const bdb = require('better-sqlite3')('./fish-hunt.db')

function handleDBError(err, res){
    errorJson = {
        message : "the database blew up",
        status : 500
    };
    res.status(jsonOutput["status"]).json(errorJson);
}

router.get("/", function(_, res){
    var body = {
        message : "Server is up!",
        status : 200
    };
    res.json(body);
});

router.get("/auth", function(req, res){
    const query = "SELECT * FROM rod_info WHERE rod_uuid = $param_uuid AND player_username = $param_username";
    db.get(query,
        {
            $param_uuid : req.query.id,
            $param_username : req.query.username
        },
        function(err, rows){
            if (err) {
                handleDBError(err,res);
            }
            else {
                var jsonOutput = {}
                if (rows){
                    jsonOutput = {
                        message : "Authorization Successful",
                        status : 200
                    };
                }
                else{
                    jsonOutput = {
                        message : "Authorization Failed, Rod cannot be transferred to another player",
                        status : 403
                    }
                }
                res.json(jsonOutput);
            }
        }
    );
});

router.get("/bsql-auth", function(req,res){
    const query = "SELECT * FROM rod_info WHERE rod_uuid = ? AND player_username = ?";
    const stmt = bdb.prepare(query);

    try{
        const result = stmt.get(req.query.id,req.query.username);
        var jsonOutput = {}
        if (result){
            jsonOutput = {
                message : "Authorization Successful",
                status : 200
            };
        }
        else{
            jsonOutput = {
                message : "Authorization Failed, Rod cannot be transferred to another player",
                status : 403
            }
        }
        res.status(jsonOutput["status"]).json(jsonOutput);
    }
    catch (err){
        handleDBError(err,res);
    }

});

router.get("/fish", function(_, res){
    db.all("SELECT * FROM fish", function (err, rows) {
        if (err) {
            handleDBError(err,res);
        }
        else{
            console.log(rows);
            var jsonFish = rows;
            res.json(jsonFish);
        }
    });
});

// other than the already defined routes
router.all('*', function(_,res){
    var body = {
        message : "You are accessing page that does not exist!",
        status : 404
    };
    res.status(404).json(body)
});

process.on('SIGINT', () => {
    db.close();
    server.close();
});

module.exports = router;