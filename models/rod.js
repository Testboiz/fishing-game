const db = require("../singletons/db");
const CONSTANTS = require("../singletons/constants");

const myUtils = require("../utils");

/**
 * Represents the Rod object and its cast and worm utilities
 * @property {string} rod_uuid The uuid of the rod
 * @property {number} small_worms The small worms count for the rod
 * @property {number} tasty_worms The tasty worms count for the rod
 * @property {number} enchanted_worms The enchanted worms count for the rod
 * @property {number} magic_worms The magic worms count for the rod
 * @property {string} player_uuid The uuid of the player
 * @property {number} alacrity_charges The amnount of alacrity (speed boost) active on the rod
 * @property {number} rod_type The type of the rod in enumerated integer
 * @property {number} selected_worm The selected worm type in enumerated integer
 * @class Rod
 */
class Rod {
    #rod_uuid;
    #small_worms;
    #tasty_worms;
    #enchanted_worms;
    #magic_worms;
    #player_uuid;
    #alacrity_charges;
    #rod_type;
    #selected_worm;

    /**
     * Creates an instance of Rod.
     * @param {Object} options The configuration object for the Rod
     * @param {string} options.rod_uuid The uuid of the rod
     * @param {number} [options.small_worms=0] The small worms count for the rod (defaults to 0)
     * @param {number} [options.tasty_worms=0] The tasty worms count for the rod (defaults to 0)
     * @param {number} [options.enchanted_worms=0] The enchanted worms count for the rod (defaults to 0)
     * @param {number} [options.magic_worms=0] The magic worms count for the rod (defaults to 0)
     * @param {string} [options.player_uuid=""] The uuid of the player (defaults to empty string)
     * @param {number} [options.alacrity_charges=0] The amnount of alacrity (speed boost) active on the rod (defaults to 0)
     * @param {number} [options.rod_type=1] The type of the rod in enumerated integer (defaults to Begginer Rod)
     * @param {number} [options.selected_worm=1] The selected worm type in enumerated integer (defaults to Small Worms)
     * @memberof Rod
     */
    constructor({
        rod_uuid,
        small_worms = 0,
        tasty_worms = 0,
        enchanted_worms = 0,
        magic_worms = 0,
        player_uuid = "",
        alacrity_charges = 0,
        rod_type = 1,
        selected_worm = 1
    }) {
        this.#rod_uuid = rod_uuid;
        this.#small_worms = small_worms;
        this.#tasty_worms = tasty_worms;
        this.#enchanted_worms = enchanted_worms;
        this.#magic_worms = magic_worms;
        this.#player_uuid = player_uuid;
        this.#alacrity_charges = alacrity_charges;
        this.#rod_type = rod_type;
        this.#selected_worm = selected_worm;
    }
    /**
     * Creates an instance of Rod from an entry of the database.
     * Returns Error if the uuid is invalid
     * @static
     * @param {string} player_uuid The uuid of the player.
     * @returns {Rod} The instance of Rod
     * @memberof Rod
     */
    static fromDB(rod_uuid) {
        const sql = "SELECT * FROM rod_info WHERE rod_uuid = ?";

        try {
            const stmt = db.prepare(sql);
            const row = stmt.get(rod_uuid);
            if (!row) {
                throw new Error("Invalid Key");
            }

            return new Rod({
                rod_uuid: rod_uuid,
                small_worms: row.small_worms,
                tasty_worms: row.tasty_worms,
                enchanted_worms: row.enchanted_worms,
                magic_worms: row.magic_worms,
                player_uuid: row.player_uuid,
                alacrity_charges: row.alacrity_charges,
                rod_type: row.rod_type,
                selected_worm: row.selected_worm
            });
        }
        catch (err) {
            throw err;
        }
    }

    /**
     * Gets the base XP of each rod type
     * @return {number} the base XP value of the each rod type 
     * @memberof Rod
     */
    #getBaseXP() {
        const ROD_TYPES = CONSTANTS.ENUMS.ROD;
        const BASE_XP = CONSTANTS.BASE_XP;
        switch (this.#rod_type) {
            case ROD_TYPES.BEGINNER:
                return BASE_XP.BEGINNER;
            case ROD_TYPES.PRO:
                return BASE_XP.PRO;
            case ROD_TYPES.ENCHANTED:
                return BASE_XP.ENCHANTED;
            case ROD_TYPES.MACIC:
                return BASE_XP.MAGIC;
            case ROD_TYPES.SHARK:
                return BASE_XP.SHARK;
            case ROD_TYPES.COMP_1:
                return BASE_XP.COMP_1;
            case ROD_TYPES.COMP_2:
                return BASE_XP.COMP_2;
            default:
                throw new Error("Invalid Rod");
        }
    }
    /**
     * Adds an entry of the Rod object to the database
     * @memberof Rod
     */
    addToDB() {
        const sql = `
INSERT INTO rod_info (
    rod_uuid,
    small_worms,
    tasty_worms,
    enchanted_worms,
    magic_worms,
    player_uuid,
    alacrity_charges,
    rod_type
    )
VALUES (
    :rod_uuid,
    :small_worms,
    :tasty_worms,
    :enchanted_worms,
    :magic_worms,
    :player_uuid,
    :alacrity_charges,
    :rod_type
    );`;
        try {
            const stmt = db.prepare(sql);
            stmt.run({
                rod_uuid: this.#rod_uuid,
                small_worms: this.#small_worms,
                tasty_worms: this.#tasty_worms,
                enchanted_worms: this.#enchanted_worms,
                magic_worms: this.#magic_worms,
                player_uuid: this.#player_uuid,
                alacrity_charges: this.#alacrity_charges,
                rod_type: this.#rod_type
            });
        } catch (err) {
            throw err;
        }
    }

    /**
     * Commits changes of the object to the database
     * @memberof Rod
     */
    updateToDB() {
        const sql = `
UPDATE rod_info SET
    small_worms = :small_worms,
    tasty_worms = :tasty_worms,
    enchanted_worms = :enchanted_worms,
    magic_worms = :magic_worms,
    alacrity_charges = :alacrity_charges
WHERE rod_uuid = :rod_uuid
`;
        try {
            const stmt = db.prepare(sql);
            stmt.run({
                small_worms: this.#small_worms,
                tasty_worms: this.#tasty_worms,
                enchanted_worms: this.#enchanted_worms,
                magic_worms: this.#magic_worms,
                alacrity_charges: this.#alacrity_charges,
                rod_uuid: this.#rod_uuid
            });
        } catch (err) {
            throw err;
        }
    }
    /**
     * Performs the cast logic and provides the updated Rod object
     * @param {Rod} RodObject The rod to be cast
     * @returns The updated Rod object after casting
     * @memberof Rod
     */
    static cast(RodObject) {
        const sql = `
UPDATE rod_info 
SET 
    small_worms = CASE WHEN selected_worm = 1 THEN small_worms - 1 ELSE small_worms END,
    tasty_worms = CASE WHEN selected_worm = 2 THEN tasty_worms - 1 ELSE tasty_worms END,
    enchanted_worms = CASE WHEN selected_worm = 3 THEN enchanted_worms - 1 ELSE enchanted_worms END,
    magic_worms = CASE WHEN selected_worm = 4 THEN magic_worms - 1 ELSE magic_worms END,
    alacrity_charges = CASE WHEN alacrity_charges > 0 THEN alacrity_charges - 1 ELSE alacrity_charges END
WHERE rod_uuid = ?;`;
        try {
            const stmt = db.prepare(sql);
            stmt.run(RodObject.rod_uuid);

            return Rod.fromDB(RodObject.rod_uuid);
        } catch (err) {
            throw err;
        }
    }
    /**
     *  Computes the XP gained from each cast, with fish lottery consideration
     * @param {Array<boolean>} xpLotteryTriggers The XP lottery trigger array
     * @returns The computed XP
     * @memberof Rod
     */
    computeXP(xpLotteryTriggers) {
        try {
            var eXP = this.#getBaseXP();
            const currentTime = new Date();
            const isWeekend = myUtils.isWeekend(currentTime);

            if (isWeekend) {
                eXP = eXP * 3;
            }
            if (xpLotteryTriggers.first) eXP += 2;
            if (xpLotteryTriggers.second) eXP += 2;
            return eXP;
        } catch (err) {
            throw err;
        }
    }
    /**
     * Checks if the rod has been transfered or not 
     * If the transfer is done, it would block the usability
     * @param {string} player_uuid The player uuid to be verified
     * @returns The boolean value of the existence of the record that verifies the ownership of the rod
     * @memberof Rod
     */
    authenticate(player_uuid) {
        const sql = "SELECT * FROM rod_info WHERE rod_uuid = ? AND player_uuid = ?";
        try {
            const result = db.prepare(sql).get(this.#rod_uuid, player_uuid);
            return (result != null);
        } catch (err) {
            throw err;
        }
    }
    /**
     * Adds the worms if the lottery winnings are worms.
     * @memberof Rod
     */
    addLotteryWorms() {
        const sql = `
UPDATE rod_info
SET
    small_worms = CASE WHEN selected_worm = 1 THEN small_worms + 2 ELSE small_worms END,
    tasty_worms = CASE WHEN selected_worm = 2 THEN tasty_worms + 2 ELSE tasty_worms END,
    enchanted_worms = CASE WHEN selected_worm = 3 THEN enchanted_worms + 2 ELSE enchanted_worms END,
    magic_worms = CASE WHEN selected_worm = 4 THEN magic_worms + 2 ELSE magic_worms END
WHERE rod_uuid = ?
        `;
        try {
            const stmt = db.prepare(sql);
            stmt.run(this.#rod_uuid);
        } catch (err) {
            throw err;
        }
    }
    /**
     * Adds small worms to the rod 
     * @param {number} small_worms The amnount of small worms to be added
     */
    add_small_worms(small_worms) {
        this.#small_worms = this.#small_worms + small_worms;
    }
    /**
     * Adds tasty worms to the rod 
     * @param {number} tasty_worms The amnount of tasty worms to be added
     */
    add_tasty_worms(tasty_worms) {
        this.#tasty_worms = this.#tasty_worms + tasty_worms;
    }
    /**
     * Adds enchanted worms to the rod 
     * @param {number} enchanted_worms The amnount of enchanted worms to be added
     */
    add_enchanted_worms(enchanted_worms) {
        this.#enchanted_worms = this.#enchanted_worms + enchanted_worms;
    }
    /**
     * Adds magic worms to the rod 
     * @param {number} magic_worms The amnount of magic worms to be added
     */
    add_magic_worms(magic_worms) {
        this.#magic_worms = this.#magic_worms + magic_worms;
    }
    /**
     * Adds alacrity charges to the rod 
     * @param {number} alacrity_charges The amnount of alacrity charges to be added
     */
    add_alacrity_charges(alacrity_charges) {
        this.#alacrity_charges = this.#alacrity_charges + alacrity_charges;
    }

    get small_worms() {
        return this.#small_worms;
    }
    get tasty_worms() {
        return this.#tasty_worms;
    }
    get enchanted_worms() {
        return this.#enchanted_worms;
    }
    get magic_worms() {
        return this.#magic_worms;
    }
    get alacrity_charges() {
        return this.#alacrity_charges;
    }
    get selected_worm() {
        return this.#selected_worm;
    }
}

module.exports = Rod;