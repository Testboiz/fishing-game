const db = require("../singletons/db");

const CONSTANTS = require("../singletons/constants");
const myUtils = require("../utils");

class Cashout {
    #player_username;
    #cashout_balance;
    #cashout_quota;
    #last_major_cashout;
    #maximum_cashout_value;


    constructor({
        player_username = "",
        cashout_balance = 0,
        cashout_quota = CONSTANTS.CASHOUT_DEFAULT_VALUE,
        last_major_cashout = Math.floor(Date.now() / CONSTANTS.MILISECONDS_IN_SECOND),
        maximum_cashout_value = CONSTANTS.CASHOUT_DEFAULT_VALUE
    }) {
        this.#player_username = player_username;
        this.#cashout_balance = cashout_balance;
        this.#cashout_quota = cashout_quota;
        this.#last_major_cashout = last_major_cashout;
        this.#maximum_cashout_value = maximum_cashout_value;
    }

    static fromDB(player_username) {
        const sqlCashoutInfo = `
SELECT cashout.cashout_budget, cashout.last_major_cashout, cashout.balance, cashout_values.cashout_value
FROM cashout 
INNER JOIN cashout_values ON cashout.cashout_type = cashout_values.cashout_type
WHERE cashout.player_username = ?
`;

        try {
            const cashoutInfo = db.prepare(sqlCashoutInfo).get(player_username);
            return new Cashout({
                player_username: player_username,
                cashout_balance: Number(cashoutInfo.balance),
                cashout_quota: Math.min(cashoutInfo.balance, Number(cashoutInfo.cashout_budget)),
                last_major_cashout: myUtils.sqlToJSDateUTC(cashoutInfo.last_major_cashout),
                maximum_cashout_value: Number(cashoutInfo.cashout_value)
            });
        }
        catch (err) {
            throw err;
        }
    }

    addToDB() {
        const sql = `
INSERT INTO cashout (
    player_username,
    balance,
    last_major_cashout
  )
VALUES (
    :player_username,
    :balance,
    DATETIME(:last_major_cashout, 'unixepoch')
  );
       `;
        try {
            const stmt = db.prepare(sql);
            stmt.run({
                player_username: this.#player_username,
                balance: this.#cashout_balance,
                last_major_cashout: this.#last_major_cashout,
            });
        } catch (err) {
            throw err;
        }
    }
    cashout() {
        const sqlUpdateCashoutWithinADay = `
UPDATE cashout
    SET
    cashout_budget = cashout.cashout_budget - :cashout_amnount,
    balance = balance - :cashout_amnount,
    last_major_cashout =
        CASE
            WHEN cashout.cashout_budget - :cashout_amnount = 0
            THEN DATETIME('now')
            ELSE last_major_cashout
        END
    WHERE cashout.player_username = :username
    `;
        const sqlUpdateCashoutOverADay = `
UPDATE cashout
    SET
        cashout_budget = :cashout_max_value - :cashout_amnount,
        balance = balance - :cashout_amnount,
        last_major_cashout = DATETIME('now')
    WHERE player_username = :username
    `;
        try {
            const stmtUpdateCashoutWithinADay = db.prepare(sqlUpdateCashoutWithinADay);
            const stmtUpdateCashoutOverADay = db.prepare(sqlUpdateCashoutOverADay);
            const isWithinADay = myUtils.isWithinADay(this.#last_major_cashout);
            const remainingBalanceOverADay = this.#cashout_balance - this.#maximum_cashout_value;
            const remainingBalanceWithinADay = this.#cashout_balance - this.#cashout_quota;
            if (Math.floor(this.#cashout_balance) === 0) {
                return {
                    quota: 0,
                    balanceToShow: myUtils.roundToFixed(this.#cashout_balance),
                };
            }
            else if (Math.floor(this.#cashout_quota) === 0) {
                if (isWithinADay) {
                    const remainingMs = cashoutInfo.remainingTimeMs;
                    const hh_mm_ss = myUtils.getHHMMSSFromMiliseconds(remainingMs);
                    return {
                        quota: 0,
                        balanceToShow: myUtils.roundToFixed(this.#cashout_balance),
                        remainingTime: hh_mm_ss
                    };
                }
                else {
                    stmtUpdateCashoutOverADay.run({
                        "username": this.#player_username,
                        "cashout_amnount": Math.min(this.#cashout_balance, this.#maximum_cashout_value),
                        "cashout_max_value": this.#maximum_cashout_value
                    });
                    const updatedRoundedBalance = myUtils.roundToFixed(remainingBalanceOverADay);
                    return {
                        quota: this.#maximum_cashout_value,
                        balanceToShow: updatedRoundedBalance,
                    };
                }
            }
            else {
                if (isWithinADay) {
                    stmtUpdateCashoutWithinADay.run({
                        "username": this.#player_username,
                        "cashout_amnount": this.#cashout_quota
                    });
                    const updatedRoundedBalance = myUtils.roundToFixed(remainingBalanceWithinADay);
                    return {
                        quota: this.#cashout_quota,
                        balanceToShow: updatedRoundedBalance,
                    };
                }
                else {
                    stmtUpdateCashoutOverADay.run({
                        "username": this.#player_username,
                        "cashout_amnount": this.#cashout_quota,
                        "cashout_max_value": this.#maximum_cashout_value
                    });
                    const updatedRoundedBalance = myUtils.roundToFixed(remainingBalanceOverADay);
                    return {
                        quota: this.#maximum_cashout_value,
                        balanceToShow: updatedRoundedBalance,
                    };
                }
            }
        }
        catch (err) {
            throw err;
        }
    }
}

module.exports = Cashout;