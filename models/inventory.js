const db = require("../singletons/db");

/**
 * The class representing the Inventory object of the player
 * @property {string} player_uuid The uuid of the player
 * @property {number} gold The count of gold in the inventory
 * @property {number} fish The count of fish in the inventory
 * @property {number} powder The count of powders in the inventory
 * @class Inventory
 */
class Inventory {
    /**
     * Creates an instance of Inventory.
     * @param {Object} options The configuration object for the Inventory
     * @param {string} [options.player_uuid=""] The uuid of the player (defaults to empty string)
     * @param {number} [options.gold=0] The count of gold in the inventory (defaults to 0)
     * @param {number} [options.fish=0] The count of fish in the inventory (defaults to 0)
     * @param {number} [options.powder=0] The count of powders in the inventory (default to 0)
     * @memberof Inventory
     */
    constructor({
        player_uuid = "",
        gold = 0,
        fish = 0,
        powder = 0
    }) {
        this.player_uuid = player_uuid;
        this.gold = gold;
        this.fish = fish;
        this.powder = powder;
    }
    /**
     * Creates an instance of Inventory from an entry of the database.
     * Returns Error if the uuid is invalid
     * @static
     * @param {string} player_uuid The uuid of the player.
     * @returns {Inventory} The instance of Inventory
     * @memberof Inventory
     */
    static fromDB(player_uuid) {
        const sql = "SELECT * FROM inventory WHERE player_uuid = ?";

        try {
            const stmt = db.prepare(sql);
            const row = stmt.get(player_uuid);
            if (!row) {
                throw new Error("Invalid Key");
            }

            return new Inventory({
                player_uuid: player_uuid,
                gold: row.gold,
                powder: row.powder,
                fish: row.fish
            });
        }
        catch (err) {
            throw err;
        }
    }
    /**
     * Adds an entry of the Inventory object to the database
     * @memberof Inventory
     */
    addToDB() {
        const sql = `
INSERT INTO inventory
(player_uuid, gold, fish, powder)
VALUES
(:username , :gold, :fish, :powder) `;
        try {
            const stmt = db.prepare(sql);
            stmt.run({
                username: this.player_uuid,
                gold: this.gold,
                fish: this.fish,
                powder: this.powder
            });
        }
        catch (err) {
            throw err;
        }
    }
    /**
     * Commits changes of the object to the database
     * @memberof Inventory
     */
    updateDB() {
        const sql = `
UPDATE inventory
SET
gold = :gold,
powder = :powder,
fish = :fish
WHERE player_uuid = :username;
`;
        try {
            const stmt = db.prepare(sql);
            stmt.run({
                username: this.player_uuid,
                gold: this.gold,
                fish: this.fish,
                powder: this.powder
            });

        } catch (err) {
            throw err;
        }
    }

    /**
     * Generates an object (JSON syntax) representation of the Inventory object
     * @return {object} 
     * @memberof Inventory
     */
    toObject() {
        const obj = {};
        Object.getOwnPropertyNames(this).forEach((key) => {
            obj[key] = this[key];
        });
        return obj;
    }

    /**
     * Adds `goldAmnount` of gold to the Inventory
     *
     * @param {number} goldAmnount
     * @memberof Inventory
     */
    addGold(goldAmnount) {
        this.gold = this.gold + goldAmnount;
    }
    /**
     * Adds `fishAmnount` amnount of fish to the Inventory
     *
     * @param {number} fishAmnount
     * @memberof Inventory
     */
    addFish(fishAmnount) {
        this.fish = this.fish + fishAmnount;
    }
    /**
     * Adds `powderAmnount` of powder to the Inventory
     *
     * @param {number} powderAmnount
     * @memberof Inventory
     */
    addPowder(powderAmnount) {
        this.powder = this.powder + powderAmnount;
    }
    /**
     * Takes `goldAmnount` of gold to the Inventory
     *
     * @param {number} goldAmnount
     * @memberof Inventory
     */
    takeGold(goldAmnount) {
        this.gold = this.gold - goldAmnount;
    }
    /**
     * Takes `fishAmnount` of fish to the Inventory
     *
     * @param {number} fishAmnount
     * @memberof Inventory
     */
    takeFish(fishAmnount) {
        this.fish = this.fish - fishAmnount;
    }
    /**
     * Takes `powderAmnount` of powder to the Inventory
     *
     * @param {number} powderAmnount
     * @memberof Inventory
     */
    takePowder(powderAmnount) {
        this.powder = this.powder - powderAmnount;
    }
}

module.exports = Inventory;