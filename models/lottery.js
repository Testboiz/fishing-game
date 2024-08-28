const db = require("../singletons/db");
const CONSTANTS = require("../singletons/constants");

class FishLottery {
    #lotteryName;

    constructor() {
        const sql = `
SELECT name
FROM fish_lottery
WHERE probability < ?
ORDER BY probability DESC
LIMIT 1;
        `;
        const prob = Math.random();
        try {
            if (prob > CONSTANTS.FISH_LOTTERY_RATE) {
                const stmt = db.prepare(sql);
                const row = stmt.get(prob);

                this.#lotteryName = row.name;
            }
            else {
                this.#lotteryName = "None";
            }

        } catch (err) {
            throw err;
        }
    }
    generateLotteryMessage(rod_uuid) {
        const lotteryMessage = "Fish Lottery:\n";
        const sqlWormInfo = "SELECT selected_worm FROM rod_info WHERE rod_uuid = ?";
        switch (this.#lotteryName) {
            case "alacrity":
                return lotteryMessage + "You've won 5 Alacrity charges (fast cast)\n";
            case "powder":
                return lotteryMessage + "You've won 2 Magic Powder (Shubbies Pet Food)!\n";
            case "xp":
                return lotteryMessage + "You've won 2 Fishing Experience\n";
            default:
                if (this.#lotteryName.includes("Worms")) {
                    const stmtWormInfo = db.prepare(sqlWormInfo);
                    const wormName = this.#setWormType(stmtWormInfo.get(rod_uuid));
                    return lotteryMessage + `You've won 2 ${wormName}!\n`;
                }
                else {
                    return "\n";
                }
        }
    }
    #setWormType() {
        switch (this.#lotteryName) {
            case 1:
                return "Small Worms";
            case 2:
                return "Tasty Worms";
            case 3:
                return "Enchanted Worms";
            case 4:
                return "Magic Worms";
            default:
                return "Undefined Worm Type";
        }
    }
};

module.exports = FishLottery;