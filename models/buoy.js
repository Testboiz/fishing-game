const CONSTANTS = require("../singletons/constants");
const db = require("../singletons/db");
const myUtils = require("../utils");

class Buoy {
    #buoy_uuid;
    #buoy_balance;
    #fishpot;
    #buoy_location_name;
    #buoy_multiplier;
    #buoy_color;

    constructor({
        buoy_uuid,
        buoy_balance = 0,
        fishpot = 0,
        buoy_location_name,
        buoy_multiplier = 1,
        buoy_color = CONSTANTS.ENUMS.BUOY_COLOR.BLUE
    }) {
        this.#buoy_uuid = buoy_uuid;
        this.#buoy_balance = buoy_balance;
        this.#fishpot = fishpot;
        this.#buoy_location_name = buoy_location_name;
        this.#buoy_multiplier = buoy_multiplier;
        this.#buoy_color = buoy_color;
    }
    static fromDB(buoy_uuid) {
        const sql = "SELECT * FROM buoy WHERE buoy_uuid = ?";

        try {
            const stmt = db.prepare(sql);
            const row = stmt.get(buoy_uuid);
            if (!row) {
                throw new Error("Invalid Key");
            }

            return new Buoy({
                buoy_uuid: buoy_uuid,
                buoy_balance: row.buoy_balance,
                fishpot: row.fishpot,
                buoy_location_name: row.buoy_location_name,
                buoy_multiplier: row.buoy_multiplier,
                buoy_color: row.buoy_color
            });
        }
        catch (err) {
            throw err;
        }
    }

    addToDB() {
        const sql = `
INSERT INTO buoy (
    buoy_uuid,
    buoy_balance,
    fishpot,
    buoy_location_name,
    buoy_multiplier,
    buoy_color
  )
VALUES (
    :buoy_uuid,
    :buoy_balance,
    :fishpot,
    :buoy_location_name,
    :buoy_multiplier,
    :buoy_color
  );`;
        try {
            const stmt = db.prepare(sql);
            stmt.run({
                buoy_uuid: this.#buoy_uuid,
                buoy_balance: this.#buoy_balance,
                fishpot: this.#fishpot,
                buoy_location_name: this.#buoy_location_name,
                buoy_multiplier: this.#buoy_multiplier,
                buoy_color: this.#buoy_color
            });
        }
        catch (err) {
            throw err;
        }
    }

    updateToDB() {
        const sql = `
UPDATE buoy
SET
    buoy_balance = :buoy_balance,
    fishpot = :fishpot,
    buoy_location_name = :buoy_location_name,
    buoy_multiplier = :buoy_multiplier,
    buoy_color = :buoy_color
WHERE buoy_uuid = :buoy_uuid;
`;
        try {
            const stmt = db.prepare(sql);
            stmt.run({
                buoy_uuid: this.#buoy_uuid,
                buoy_balance: this.#buoy_balance,
                fishpot: this.#fishpot,
                buoy_location_name: this.#buoy_location_name,
                buoy_multiplier: this.#buoy_multiplier,
                buoy_color: this.#buoy_color
            });

        } catch (err) {
            throw err;
        }
    }
    calculateTax() {
        try {
            switch (this.#buoy_color) {
                case "red":
                    return 0.5;
                case "yellow":
                    return 0.75;
                case "blue":
                    return 0.85;
                default:
                    throw new Error("Unidentified Buoy Color");
            }
        }
        catch (err) {
            throw err;
        }
    }
    #addSpookRecord(buoy_uuid, player_username) {
        const sql = `
INSERT INTO buoy_casts 
(buoy_uuid, player_username, casts)
VALUES
(?,?,0)`;
        try {
            db.prepare(sql).run(buoy_uuid, player_username);
        } catch (err) {
            throw err;
        }
    }
    getCastsAndSpookTime(buoy_uuid, player_username) {
        const sql = `
SELECT casts, previous_spook_time FROM buoy_casts
WHERE buoy_uuid = ? AND player_username = ?;`;
        try {
            const stmt = db.prepare(sql);
            const rows = stmt.get(buoy_uuid, player_username);
            if (rows) {
                return {
                    casts: rows.casts,
                    previous_spook_time: rows.previous_spook_time
                };
            }
            else {
                this.#addSpookRecord(buoy_uuid, player_username);
                const newRows = stmt.get(buoy_uuid, player_username);
                return {
                    casts: newRows.casts,
                    previous_spook_time: newRows.previous_spook_time
                };
            }
        } catch (err) {
            throw err;
        }
    }
    updateAfterCast(fishValue, player_username) {
        const sqlBuoyUpdate = `
UPDATE buoy 
    SET 
    buoy_balance = buoy_balance - ?,
    fishpot = fishpot +  ?
WHERE buoy_uuid = ?;
    `;
        const sqlCastUpdate = `
INSERT INTO buoy_casts (buoy_uuid, player_username, casts) VALUES (?,?,0)
    ON CONFLICT (buoy_uuid, player_username) DO UPDATE SET casts = casts + 1;
    `;
        try {
            const stmtBuoyUpdate = db.prepare(sqlBuoyUpdate);
            const stmtCastUpdate = db.prepare(sqlCastUpdate);
            const updateAfterCastTransaction = db.transaction(function () {
                stmtBuoyUpdate.run(fishValue, fishValue * this.#buoy_multiplier, this.#buoy_uuid);
                stmtCastUpdate.run(player_username);
            });
            updateAfterCastTransaction();
        } catch (err) {
            throw err;
        }
    }

    getFishpot(Balance) {
        try {
            const fishpotValue = this.#fishpot;
            const fishpotString = myUtils.roundToFixed(fishpotValue);

            this.#fishpot = 0;
            const commitChanges = db.transaction(function (buoyObject) {
                buoyObject.updateToDB();
                Balance.addBalance(fishpotValue);
            });
            commitChanges(this);
            return fishpotString;
        } catch (err) {
            throw err;
        }
    }
    addBalance(balance) {
        this.#buoy_balance + balance;
    }
    getMultipliedFishValue(fish_value) {
        return this.#buoy_multiplier * fish_value;
    }
    get buoy_balance() {
        return this.#buoy_balance;
    }
    get fishpot() {
        return this.#fishpot;
    }
    get buoy_location_name() {
        return this.#buoy_location_name;
    }
    get buoy_multiplier() {
        return this.#buoy_multiplier;
    }
    get buoy_color() {
        return this.#buoy_color;
    }
    set buoy_balance(buoy_balance) {
        this.#buoy_balance = buoy_balance;
    }
    set fishpot(fishpot) {
        this.#fishpot = fishpot;
    }
    set buoy_location_name(buoy_location_name) {
        this.#buoy_location_name = buoy_location_name;
    }
    set buoy_multiplier(buoy_multiplier) {
        this.#buoy_multiplier = buoy_multiplier;
    }
    set buoy_color(buoy_color) {
        this.#buoy_color = buoy_color;
    }

}

module.exports = Buoy;