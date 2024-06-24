// const sqlite3 = require('sqlite3').verbose();
// const db = new sqlite3.Database(':memory:');

var express = require("express");
var routes = require('./routes');

var app = express()
const port = 3000;

app.use("/", routes);

app.listen(port,function(){
    console.log("running in port " + port);
})


