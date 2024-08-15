class Inventory {
    constructor({
        db,
        player_username = "",
        gold = 0,
        fish = 0,
        powder = 0
    }) {
        this.db = db;
        this.player_username = player_username;
        this._gold = gold;
        this._fish = fish;
        this._powder = powder;
        if (!db) {
            throw new Error("No Database Connection");
        }
    }

    static fromDB(db, player_username) {
        const sql = "SELECT * FROM inventory WHERE player_username = ?";

        try {
            const stmt = db.prepare(sql);
            const inventoryRow = stmt.get(player_username);
            if (!inventoryRow) {
                throw new Error("Invalid Key");
            }
            if (!db) {
                throw new Error("No Database Connection");
            }

            return new Inventory({
                db: db,
                player_username: player_username,
                gold: inventoryRow.gold,
                powder: inventoryRow.powder,
                fish: inventoryRow.fish
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
            const stmt = this.db.prepare(sql);
            stmt.run({
                username: this.player_username,
                gold: this._gold,
                fish: this._fish,
                powder: this._powder
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
            const stmt = this.db.prepare(sql);
            stmt.run({
                username: this.player_username,
                gold: this._gold,
                fish: this._fish,
                powder: this._powder
            });

        } catch (err) {
            throw err;
        }
    }

    get gold() {
        return this._gold;
    }
    get fish() {
        return this._fish;
    }
    get powder() {
        return this._powder;
    }
    set gold(goldAmnount) {
        this._gold = goldAmnount;
    }
    set fish(fishAmnount) {
        this._fish = fishAmnount;
    }
    set powder(powderAmnount) {
        this._powder = powderAmnount;
    }
    addGold(goldAmnount) {
        this._gold = this._gold + goldAmnount;
    }
    addFish(fishAmnount) {
        this._fish = this._fish + fishAmnount;
    }
    addPowder(powderAmnount) {
        this._powder = this._powder + powderAmnount;
    }
    takeGold(goldAmnount) {
        this._gold = this._gold - goldAmnount;
    }
    takeFish(fishAmnount) {
        this._fish = this._fish - fishAmnount;
    }
    takePowder(powderAmnount) {
        this._powder = this._powder - powderAmnount;
    }
}

module.exports = Inventory;