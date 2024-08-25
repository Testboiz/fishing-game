const db = require("better-sqlite3")("singletons/fish-hunt.db");

db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 3000");

module.exports = db;