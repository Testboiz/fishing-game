const db = require("../singletons/db");

class Inventory {
    #player_username;
    #gold;
    #fish;
    #powder;
    constructor({
        player_username = "",
        gold = 0,
        fish = 0,
        powder = 0
    }) {
        this.#player_username = player_username;
        this.#gold = gold;
        this.#fish = fish;
        this.#powder = powder;
    }

    static fromDB(player_username) {
        const sql = "SELECT * FROM inventory WHERE player_username = ?";

        try {
            const stmt = db.prepare(sql);
            const row = stmt.get(player_username);
            if (!row) {
                throw new Error("Invalid Key");
            }

            return new Inventory({
                player_username: player_username,
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
(player_username, gold, fish, powder)
VALUES
(:username , :gold, :fish, :powder) `;
        try {
            const stmt = db.prepare(sql);
            stmt.run({
                username: this.#player_username,
                gold: this.#gold,
                fish: this.#fish,
                powder: this.#powder
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
WHERE player_username = :username;
`;
        try {
            const stmt = db.prepare(sql);
            stmt.run({
                username: this.#player_username,
                gold: this.#gold,
                fish: this.#fish,
                powder: this.#powder
            });

        } catch (err) {
            throw err;
        }
    }

    get gold() {
        return this.#gold;
    }
    get fish() {
        return this.#fish;
    }
    get powder() {
        return this.#powder;
    }
    set gold(gold) {
        this.#gold = gold;
    }
    set fish(fish) {
        this.#fish = fish;
    }
    set powder(powder) {
        this.#powder = powder;
    }
    addGold(goldAmnount) {
        this.#gold = this.#gold + goldAmnount;
    }
    addFish(fishAmnount) {
        this.#fish = this.#fish + fishAmnount;
    }
    addPowder(powderAmnount) {
        this.#powder = this.#powder + powderAmnount;
    }
    takeGold(goldAmnount) {
        this.#gold = this.#gold - goldAmnount;
    }
    takeFish(fishAmnount) {
        this.#fish = this.#fish - fishAmnount;
    }
    takePowder(powderAmnount) {
        this.#powder = this.#powder - powderAmnount;
    }
}

module.exports = Inventory;