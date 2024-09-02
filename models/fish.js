const db = require("../singletons/db");

/**
 * The class representing the fish that has been caught by the player
 * @property {string} fish_name The name of the fish
 * @property {number} fish_value The value of the fish
 * @property {number} multipliedValue The multiplied value of the fish from the buoy multiplier
 * @class Fish
 */
class Fish {
    /**
     * Creates an instance of Fish.
     * @param {string} buoy_uuid the buoy uuid where the fish is fished out
     * @memberof Fish
     */
    constructor(buoy_uuid) {
        const sql = `
WITH probability AS (
    SELECT ABS(RANDOM() / CAST(-9223372036854775808 AS REAL)) AS probability
)
SELECT
    f.fish_name,
    f.fish_value,
    (SELECT buoy_multiplier FROM buoy WHERE buoy_uuid = ?) AS multiplier
FROM
    fish AS f,
    probability AS pr,
    fish_probability AS p
        JOIN fish_probability ON (f.fish_probability_class = p.probability_class)
        JOIN probability ON pr.probability < p.probability_value OR f.fish_probability_class = 'Common'
        WHERE (pr.probability < p.probability_value OR f.fish_probability_class = 'Common')
        ORDER BY RANDOM()
        LIMIT 1
;
        `;
        try {
            const stmt = db.prepare(sql);
            const rows = stmt.get(buoy_uuid);

            this.fish_name = rows.fish_name;
            this.fish_value = rows.fish_value;
            this.multipliedValue = this.fish_value * rows.multiplier;
        } catch (err) {
            throw err;
        }
    }
}

module.exports = Fish;