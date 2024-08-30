const db = require("../singletons/db");

class Inventory {
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

    toObject() {
        const obj = {};
        Object.getOwnPropertyNames(this).forEach((key) => {
            obj[key] = this[key];
        });
        return obj;
    }

    addGold(goldAmnount) {
        this.gold = this.gold + goldAmnount;
    }
    addFish(fishAmnount) {
        this.fish = this.fish + fishAmnount;
    }
    addPowder(powderAmnount) {
        this.powder = this.powder + powderAmnount;
    }
    takeGold(goldAmnount) {
        this.gold = this.gold - goldAmnount;
    }
    takeFish(fishAmnount) {
        this.fish = this.fish - fishAmnount;
    }
    takePowder(powderAmnount) {
        this.powder = this.powder - powderAmnount;
    }
}

module.exports = Inventory;