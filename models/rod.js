const db = require("./singletons/db");

class Rod {
    #rod_uuid;
    #small_worms;
    #tasty_worms;
    #enchanted_worms;
    #magic_worms;
    #alacrity_charges;
    #rod_type;

    constructor({
        rod_uuid,
        small_worms = 0,
        tasty_worms = 0,
        enchanted_worms = 0,
        magic_worms = 0,
        rod_type = 1
    }) {
        this.#rod_uuid = rod_uuid;
        this.#small_worms = small_worms;
        this.#tasty_worms = tasty_worms;
        this.#enchanted_worms = enchanted_worms;
        this.#magic_worms = magic_worms;
        this.#alacrity_charges = alacrity_charges;
        this.#rod_type = rod_type;
    }

    static fromDB(rod_uuid) {
        const sql = "SELECT * FROM rod_info WHERE rod_uuid = ?";

        try {
            const stmt = db.prepare(sql);
            const row = stmt.get(buoy_uuid);
            if (!row) {
                throw new Error("Invalid Key");
            }

            return new Rod({
                rod_uuid: rod_uuid,
                small_worms: row.small_worms,
                tasty_worms: row.tasty_worms,
                enchanted_worms: row.enchanted_worms,
                magic_worms: row.magic_worms,
                alacrity_charges: row.alacrity_charges,
                rod_type: row.rod_type
            });
        }
        catch (err) {
            throw err;
        }
    }
    addToDB() {
        const sql = `
INSERT INTO rod_info (
    rod_uuid,
    small_worms,
    tasty_worms,
    enchanted_worms,
    magic_worms,
    alacrity_charges,
    rod_type
    )
VALUES (
    ':rod_uuid',
    :small_worms,
    :tasty_worms,
    :enchanted_worms,
    :magic_worms,
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
                alacrity_charges: this.#alacrity_charges,
                rod_type: this.#rod_type
            });
        } catch (err) {
            throw err;
        }
    }
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
            stmt.run(RodObject.rod_uuid());
            return new Rod.fromDB(RodObject.rod_uuid());
        } catch (err) {
            throw err;
        }
    }

    authenticate(player_username) {
        const sql = "SELECT * FROM rod_info WHERE rod_uuid = ? AND player_username = ?";
        try {
            const result = db.prepare(sql).get(this.#rod_uuid, player_username);
            return (result != null);
        } catch (err) {
            throw err;
        }
    }
    add_small_worms(small_worms) {
        this.#small_worms = this.#small_worms + small_worms;
    }
    add_tasty_worms(tasty_worms) {
        this.#tasty_worms = this.#tasty_worms + tasty_worms;
    }
    add_enchanted_worms(enchanted_worms) {
        this.#enchanted_worms = this.#enchanted_worms + enchanted_worms;
    }
    add_magic_worms(magic_worms) {
        this.#magic_worms = this.#magic_worms + magic_worms;
    }

    get rod_uuid() {
        return this.rod_uuid;
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
    set small_worms(small_worms) {
        this.#small_worms = small_worms;
    }
    set tasty_worms(tasty_worms) {
        this.#tasty_worms = tasty_worms;
    }
    set enchanted_worms(enchanted_worms) {
        this.#enchanted_worms = enchanted_worms;
    }
    set magic_worms(magic_worms) {
        this.#magic_worms = magic_worms;
    }
    set alacrity_charges(alacrity_charges) {
        this.#alacrity_charges = alacrity_charges;
    }
}

module.exports = Rod;