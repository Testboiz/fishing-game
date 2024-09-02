const CONSTANTS = require("../singletons/constants");
const db = require("../singletons/db");
const myUtils = require("../utils");

/**
 * Represents the spot where `Player` with their `Rod` fish in
 *
 *
 * @class Buoy
 * 
 * @property {string} buoy_uuid - The uuid for the buoy.
 * @property {number} buoy_balance - The initial balance of the buoy (defaults to 0).
 * @property {number} fishpot - The initial value of the fishpot (defaults to 0).
 * @property {string} buoy_location_name - The name of the location where the buoy is rezzed.
 * @property {number} buoy_multiplier - The multiplier applied to the buoy (defaults to 1).
 * @property {string} buoy_color - The color of the buoy (defaults to blue).
 *
 */
class Buoy {
    #buoy_uuid;
    #buoy_balance;
    #fishpot;
    #buoy_location_name;
    #buoy_multiplier;
    #buoy_color;

    /**
     * Creates a new instance of Buoy, to be registered to the database
     *
     * @class Buoy
     * @constructor
     * @param {Object} options - The configuration object for the Buoy.
     * @param {string} options.buoy_uuid - The uuid of the buoy.
     * @param {number} [options.buoy_balance=0] - The initial balance of the buoy (defaults to 0).
     * @param {number} [options.fishpot=0] - The initial value of the fishpot (defaults to 0).
     * @param {string} options.buoy_location_name - The name of the location where the buoy is rezzed.
     * @param {number} [options.buoy_multiplier=1] - The multiplier applied to the buoy (defaults to 1).
     * @param {string} [options.buoy_color=CONSTANTS.ENUMS.BUOY_COLOR.BLUE] - The color of the buoy (defaults to blue).
     */
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
    /**
     * Creates an instance of Buoy from an entry of the database.
     * Returns Error if the uuid is invalid
     * @static
     * @param {string} buoy_uuid The uuid of the buoy.
     * @returns {Buoy} The instance of Buoy
     * @memberof Buoy
     */
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

    /**
     * Adds an entry of the Buoy object to the database
     * @memberof Buoy
     */
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

    /**
     * Commits changes of the object to the database
     * @memberof Buoy
     */
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


    /**
     * Prevents player from fishing on the buoy for 24 hours,
     * after casting limit being raeched
     * @param {*} player_uuid The uuid of the player. 
     * @memberof Buoy
     */
    spook(player_uuid) {
        const sql = `
UPDATE buoy_casts SET
casts = 0,
previous_spook_time = DATETIME('now')
WHERE player_uuid = ? AND buoy_uuid = ?
;`;
        try {
            db.prepare(sql).run(player_uuid, this.#buoy_uuid);
        } catch (err) {
            throw err;
        }
    }

    /**
     * Checks the conditions that permits spooking, to prevent accidential spooking
     * @param {string} player_uuid The uuid of the player
     * @returns {boolean} The status of the player spooked to the buoy
     * @memberof Buoy
     */
    checkSpook(player_uuid) {
        const sql = `
SELECT casts, previous_spook_time
FROM buoy_casts
WHERE player_uuid = ?
;`;
        try {
            const stmt = db.prepare(sql);
            const rows = stmt.get(player_uuid);
            const spookDate = myUtils.sqlToJSDateUTC(rows.previous_spook_time);
            const isWithinADay = myUtils.isWithinADay(spookDate);
            console.log(spookDate);
            if (rows.casts >= CONSTANTS.CAST_LIMIT || isWithinADay) {
                return true;
            } else {
                return false;
            }

        } catch (err) {
            throw err;
        }
    }

    /**
     * Calculates the taxed balance that is added to the buoy 
     * @param {number} balance
     * @returns {number} The taxed balance to be added to the buoy
     * @memberof Buoy
     */
    #calculateTax(balance) {
        try {
            switch (this.#buoy_color) {
                case "red":
                    return 0.5 * balance;
                case "yellow":
                    return 0.75 * balance;
                case "blue":
                    return 0.85 * balance;
                default:
                    throw new Error("Unidentified Buoy Color");
            }
        }
        catch (err) {
            throw err;
        }
    }
    /**
     * Helper function to add the spook record to the database
     * @param {string} buoy_uuid The uuid of the buoy
     * @param {string} player_uuid The uuid of the player
     * @memberof Buoy
     */
    #addSpookRecord(buoy_uuid, player_uuid) {
        const sql = `
INSERT INTO buoy_casts 
(buoy_uuid, player_uuid, casts)
VALUES
(?,?,0)`;
        try {
            db.prepare(sql).run(buoy_uuid, player_uuid);
        } catch (err) {
            throw err;
        }
    }

    /**
     * Gets the record of cast and spook time, for spook verification
     * @param {string} buoy_uuid The uuid of the buoy
     * @param {string} player_uuid The uuid of the player
     * @returns {number} `casts` the count of casts of the player in the buoy
     * @returns {string} `previous_spook_time` the last time playerr spooked on the buoy
     * @memberof Buoy
     */
    getCastsAndSpookTime(buoy_uuid, player_uuid) {
        const sql = `
SELECT casts, previous_spook_time FROM buoy_casts
WHERE buoy_uuid = ? AND player_uuid = ?;`;
        try {
            const stmt = db.prepare(sql);
            const rows = stmt.get(buoy_uuid, player_uuid);
            if (rows) {
                return {
                    casts: rows.casts,
                    previous_spook_time: rows.previous_spook_time
                };
            }
            else {
                this.#addSpookRecord(buoy_uuid, player_uuid);
                const newRows = stmt.get(buoy_uuid, player_uuid);
                return {
                    casts: newRows.casts,
                    previous_spook_time: newRows.previous_spook_time
                };
            }
        } catch (err) {
            throw err;
        }
    }

    /**
     * Updates the buoy and buoy_casts table after a cast
     * @param {number} fishValue The fish value (multiplied with multiplier) to subtract the buoy balance
     * @param {string} player_uuid The uuid of the player
     * @memberof Buoy
     */
    updateAfterCast(fishValue, player_uuid) {
        const sqlBuoyUpdate = `
UPDATE buoy 
    SET 
    buoy_balance = buoy_balance - ?,
    fishpot = fishpot +  ?
WHERE buoy_uuid = ?;
    `;
        const sqlCastUpdate = `
INSERT INTO buoy_casts (buoy_uuid, player_uuid, casts) VALUES (?,?,0)
    ON CONFLICT (buoy_uuid, player_uuid) DO UPDATE SET casts = casts + 1;
    `;
        try {
            const stmtBuoyUpdate = db.prepare(sqlBuoyUpdate);
            const stmtCastUpdate = db.prepare(sqlCastUpdate);
            const updateAfterCastTransaction = db.transaction(function (buoyObject, player_uuid) {
                stmtBuoyUpdate.run(fishValue, fishValue * buoyObject.buoy_multiplier, buoyObject.buoy_uuid);
                stmtCastUpdate.run(buoyObject.buoy_uuid, player_uuid);
            });
            updateAfterCastTransaction(this, player_uuid);
        } catch (err) {
            throw err;
        }
    }

    /**
     * Gets the fishpot value, and updates the fishpot to zero
     * @param {Buoy} Balance The Buoy object that contains the fishpot balance
     * @returns {string} The formatted string of the fishpot
     * @memberof Buoy
     */
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

    /**
     * Adds the balance to the buoy, with its tax counted
     * @param {number} Balance The untaxed balance that is going to be added
     * @memberof Buoy
     */
    addBalance(balance) {
        this.#buoy_balance += this.#calculateTax(balance);
    }

    /**
     * Multiplies the fish caught value with the buoy multiplier
     * @param {number} fish_value The base fish value to be multiplied
     * @returns {number} The multiplied fish value
     * @memberof Buoy
     */
    getMultipliedFishValue(fish_value) {
        return this.#buoy_multiplier * fish_value;
    }
    get buoy_location_name() {
        return this.#buoy_location_name;
    }
    set buoy_location_name(buoy_location_name) {
        this.#buoy_location_name = buoy_location_name;
    }

}

module.exports = Buoy;