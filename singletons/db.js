const db = require("better-sqlite3")("../fish-hunt.db");

db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 3000");

module.exports = db;