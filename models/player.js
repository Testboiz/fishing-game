const db = require("../singletons/db");

class Player {
    #player_username;
    #player_display_name;
    // TODO : shubbie and kingdom
    // TODO : use player id in favor of player_username
    constructor(player_username, player_display_name) {
        this.#player_username = player_username;
        this.#player_display_name = player_display_name;
    }

    static fromDB(player_username) {
        const sql = "SELECT * FROM player WHERE player_username = ?";
        try {
            const stmt = db.prepare(sql);
            const rows = stmt.get(player_username);
            return new Player(rows.player_username, rows.player_display_name);
        } catch (err) {
            throw err;
        }
    }
    addToDB() {
        const sqlPlayer = `
INSERT INTO player (
    player_username,
    player_display_name
    )
VALUES (
    ':player_username',
    ':player_display_name'
    );`;
        const stmtRank = "INSERT INTO rank_overall (player_username) VALUES (?)";
        try {
            const stmtPlayer = db.prepare(sqlPlayer);
            const registerTransaction = db.transaction(function () {
                stmtPlayer.run({
                    player_username: this.#player_username,
                    player_display_name: this.#player_display_name
                });
                stmtRank.run(player_username);
            });
            registerTransaction();
        } catch (err) {
            throw err;
        }
    }
    changeDisplayName() {
        const sql = `
UPDATE player SET
    player_display_name = :player_display_name
WHERE player_username = :player_username;
`;
        try {
            const stmt = db.prepare(sql);
            stmt.run({
                player_username: this.#player_username,
                player_display_name: this.#player_display_name
            });
        } catch (err) {
            throw err;
        }
    }
    getRankInfo() {
        const sql = `
WITH ranked_fishers AS (
SELECT
    rank_overall.player_username,
    player.player_display_name,
    cashout.balance,
    rank_overall.xp,
    RANK() OVER (ORDER BY rank_overall.xp DESC) AS rank
FROM
    rank_overall
LEFT JOIN 
    player ON rank_overall.player_username = player.player_username,
    cashout ON rank_overall.player_username = cashout.player_username
)
SELECT
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
WHERE ro1.player_username = ?;
    `;
        try {
            const stmt = db.prepare(sql);
            return stmt.get(this.#player_username);
        } catch (err) {
            throw err;
        }
    }

    get player_display_name() {
        return this.#player_display_name;
    }
    set player_display_name(player_display_name) {
        this.#player_display_name = player_display_name;
    }
}