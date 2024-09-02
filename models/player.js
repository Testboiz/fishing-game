const db = require("../singletons/db");
const PlayerInfo = require("./player-info");

/**
 * Represents the player and handles the registration and rank process
 * @property {string} player_uuid The uuid of the player
 * @property {string} player_username the unique username of the player, for in game identification only
 * @property {string} player_display_name the display name of a player, for customization purposes
 * @class Player
 */
class Player {
    #player_uuid;
    #player_username;
    #player_display_name;
    // TODO : shubbie and kingdom
    constructor(player_uuid, player_username, player_display_name) {
        this.#player_uuid = player_uuid;
        this.#player_username = player_username;
        this.#player_display_name = player_display_name;
    }
    /**
     * Creates an instance of Player from an entry of the database.
     * Returns Error if the uuid is invalid
     * @static
     * @param {string} player_uuid The uuid of the player.
     * @returns {Player} The instance of Player
     * @memberof Player
     */
    static fromDB(player_uuid) {
        const sql = "SELECT * FROM player WHERE player_uuid = ?";
        try {
            const stmt = db.prepare(sql);
            const rows = stmt.get(player_uuid);
            if (rows) {
                return new Player(rows.player_uuid, rows.player_username, rows.player_display_name);
            }
            else {
                throw new Error("Invalid Key");
            }
        } catch (err) {
            throw err;
        }
    }
    /**
     * Checks if a player exists on the database
     * @static
     * @param {string} player_uuid The uuid of the player.
     * @return {boolean} the status of existence of the player in the database
     * @memberof Player
     */
    static isExists(player_uuid) {
        const sql = "SELECT * FROM player WHERE player_uuid = ?";
        try {
            const rows = db.prepare(sql).get(player_uuid);
            if (rows) {
                return true;
            }
            else {
                return false;
            }
        } catch (err) {
            throw err;
        }
    }
    /**
     * Adds an entry of the Player object to the database
     * @memberof Player
     */
    addToDB() {
        const sqlPlayer = `
INSERT INTO player (
    player_uuid,
    player_username,
    player_display_name
    )
VALUES (
    :player_uuid,
    :player_username,
    :player_display_name
    );`;
        const sql = "INSERT INTO rank_overall (player_uuid) VALUES (?)";
        try {
            const stmtPlayer = db.prepare(sqlPlayer);
            const stmtRank = db.prepare(sql);
            const registerTransaction = db.transaction(function (obj) {
                stmtPlayer.run({
                    player_uuid: obj.player_uuid,
                    player_username: obj.player_username,
                    player_display_name: obj.player_display_name
                });
                stmtRank.run(obj.player_uuid);
            });
            registerTransaction(this);
        } catch (err) {
            throw err;
        }
    }
    /**
     * Commits the change of the display name of the player
     *
     * @memberof Player
     */
    changeDisplayName() {
        const sql = `
UPDATE player SET
    player_display_name = :player_display_name
WHERE player_uuid = :player_uuid;
`;
        try {
            const stmt = db.prepare(sql);
            stmt.run({
                player_uuid: this.#player_uuid,
                player_display_name: this.#player_display_name
            });
        } catch (err) {
            throw err;
        }
    }
    /**
     * Commits the change of the username of the player
     *
     * @memberof Player
     */
    changeUsername() {
        const sql = `
UPDATE player SET
    player_username = :player_username
WHERE player_uuid = :player_uuid;
`;
        try {
            const stmt = db.prepare(sql);
            stmt.run({
                player_uuid: this.#player_uuid,
                player_display_name: this.#player_username
            });
        } catch (err) {
            throw err;
        }
    }

    /**
     * Gets the player information and rank of the player, after casting
     * @return {PlayerInfo} The object representing the information
     * @memberof Player
     */
    getRankInfo() {
        const sql = `
WITH ranked_fishers AS (
SELECT
    rank_overall.player_uuid,
    player.player_display_name,
    player.player_username,
    cashout.balance,
    rank_overall.xp,
    RANK() OVER (ORDER BY rank_overall.xp DESC) AS rank
FROM
    rank_overall
LEFT JOIN 
    player ON rank_overall.player_uuid = player.player_uuid,
    cashout ON rank_overall.player_uuid = cashout.player_uuid
)
SELECT
    ro1.player_uuid,
    ro1.player_username,
    ro1.player_display_name,
    ro1.balance,
    ro1.xp,
    ro1.rank,
    ro2.player_display_name AS above_display_name,
    ro2.xp - ro1.xp AS xp_difference,
    ro2.rank AS above_rank
FROM
    ranked_fishers AS ro1
LEFT JOIN 
    ranked_fishers AS ro2 ON ro1.rank = ro2.rank + 1
WHERE ro1.player_uuid = ?;
    `;
        try {
            const stmt = db.prepare(sql);
            const rows = stmt.get(this.#player_uuid);
            return new PlayerInfo({
                player_uuid: rows.player_uuid,
                player_username: rows.player_username,
                player_display_name: rows.player_display_name,
                balance: rows.balance,
                xp: rows.xp,
                rank: rows.rank,
                above_display_name: rows.above_display_name,
                xp_difference: rows.xp_difference,
                above_rank: rows.above_rank
            });
        } catch (err) {
            throw err;
        }
    }

    /**
     * Adds XP to the player
     *
     * @param {number} xpAmnount The amnount of XP to be added
     * @memberof Player
     */
    addXP(xpAmnount) {
        const sql = `UPDATE rank_overall  SET xp = xp + ? WHERE player_uuid = ?;`;
        try {
            const stmt = db.prepare(sql);
            stmt.run(xpAmnount, this.#player_uuid);
        } catch (err) {
            throw err;
        }
    }

    get player_username() {
        return this.#player_username;
    }
    get player_display_name() {
        return this.#player_display_name;
    }
    set player_username(player_username) {
        this.#player_username = player_username;
    }
    set player_display_name(player_display_name) {
        this.#player_display_name = player_display_name;
    }

}

module.exports = Player;