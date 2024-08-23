const db = require("../singletons/db");
const myUtils = require("../utils");

class Cashout {
    #player_username;
    #cashout_balance;
    #cashout_quota;
    #last_major_cashout;
    #maximum_cashout_value;


    constructor(player_username) {
        const sqlCashoutInfo = `
SELECT cashout.cashout_budget, cashout.last_major_cashout, cashout.balance, cashout_values.cashout_value
FROM cashout 
INNER JOIN cashout_values ON cashout.cashout_type = cashout_values.cashout_type
WHERE cashout.player_username = ?
`;

        try {
            const cashoutInfo = db.prepare(sqlCashoutInfo).get(player_username);
            this.#cashout_balance = Number(cashoutInfo.balance);
            this.#cashout_quota = Math.min(this.#cashout_balance, Number(cashoutInfo.cashout_budget));
            this.#last_major_cashout = myUtils.sqlToJSDateUTC(cashoutInfo.last_major_cashout);
            this.#maximum_cashout_value = Number(cashoutInfo.cashout_value);
        }
        catch (err) {
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