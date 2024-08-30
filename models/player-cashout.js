const db = require("../singletons/db");

const CONSTANTS = require("../singletons/constants");
const myUtils = require("../utils");

const { NoBalance, OutOfQuota, CashoutSuccess } = require("./cashout-status");

class Balance {
    #player_uuid;
    #balance;
    #cashout_quota;
    #last_major_cashout;
    #maximum_cashout_value;


    constructor({
        player_uuid = "",
        balance = 0,
        cashout_quota = CONSTANTS.CASHOUT_DEFAULT_VALUE,
        last_major_cashout = Math.floor(Date.now() / CONSTANTS.MILISECONDS_IN_SECOND),
        maximum_cashout_value = CONSTANTS.CASHOUT_DEFAULT_VALUE
    }) {
        this.#player_uuid = player_uuid;
        this.#balance = balance;
        this.#cashout_quota = cashout_quota;
        this.#last_major_cashout = last_major_cashout;
        this.#maximum_cashout_value = maximum_cashout_value;
    }

    static fromDB(player_uuid) {
        const sqlCashoutInfo = `
SELECT cashout.cashout_budget, cashout.last_major_cashout, cashout.balance, cashout_values.cashout_value
FROM cashout 
INNER JOIN cashout_values ON cashout.cashout_type = cashout_values.cashout_type
WHERE cashout.player_uuid = ?
`;

        try {
            const cashoutInfo = db.prepare(sqlCashoutInfo).get(player_uuid);
            return new Balance({
                player_uuid: player_uuid,
                balance: Number(cashoutInfo.balance),
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
    player_uuid,
    balance,
    last_major_cashout
  )
VALUES (
    :player_uuid,
    :balance,
    DATETIME(:last_major_cashout, 'unixepoch')
  );
       `;
        try {
            const stmt = db.prepare(sql);
            stmt.run({
                player_uuid: this.#player_uuid,
                balance: this.#balance,
                last_major_cashout: this.#last_major_cashout,
            });
        } catch (err) {
            throw err;
        }
    }
    addBalance(addedBalance) {
        const sql = `
UPDATE cashout 
SET 
    balance = balance + ?
    WHERE player_uuid = ?;
    `;
        try {
            const stmt = db.prepare(sql);
            stmt.run(Number(addedBalance), this.#player_uuid);
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
    WHERE cashout.player_uuid = :username
    `;
        const sqlUpdateCashoutOverADay = `
UPDATE cashout
    SET
        cashout_budget = :cashout_max_value - :cashout_amnount,
        balance = balance - :cashout_amnount,
        last_major_cashout = DATETIME('now')
    WHERE player_uuid = :username
    `;
        try {
            const stmtUpdateCashoutWithinADay = db.prepare(sqlUpdateCashoutWithinADay);
            const stmtUpdateCashoutOverADay = db.prepare(sqlUpdateCashoutOverADay);
            const isWithinADay = myUtils.isWithinADay(this.#last_major_cashout);
            const remainingBalanceOverADay = Math.max(this.#balance - this.#maximum_cashout_value, this.#balance % 1);
            const remainingBalanceWithinADay = Math.max(this.#balance - this.#cashout_quota, this.#balance % 1);
            if (Math.floor(this.#balance) === 0) {
                return new NoBalance(this.#balance);
            }
            else if (Math.floor(this.#cashout_quota) === 0) {
                if (isWithinADay) {
                    const remainingMs = myUtils.getRemainingMiliseconds(this.#last_major_cashout);
                    const hh_mm_ss = myUtils.getHHMMSSFromMiliseconds(remainingMs);
                    return new OutOfQuota(hh_mm_ss);
                }
                else {
                    const cashoutAmnount = Math.min(this.#balance, this.#maximum_cashout_value);
                    stmtUpdateCashoutOverADay.run({
                        "username": this.#player_uuid,
                        "cashout_amnount": cashoutAmnount,
                        "cashout_max_value": this.#maximum_cashout_value
                    });
                    return new CashoutSuccess(cashoutAmnount, this.#balance - cashoutAmnount);
                }
            }
            else {
                if (isWithinADay) {
                    stmtUpdateCashoutWithinADay.run({
                        "username": this.#player_uuid,
                        "cashout_amnount": this.#cashout_quota
                    });
                    return new CashoutSuccess(this.#cashout_quota, remainingBalanceWithinADay);
                }
                else {
                    stmtUpdateCashoutOverADay.run({
                        "username": this.#player_uuid,
                        "cashout_amnount": this.#cashout_quota,
                        "cashout_max_value": this.#maximum_cashout_value
                    });
                    return new CashoutSuccess(this.#maximum_cashout_value, remainingBalanceOverADay);
                }
            }
        }
        catch (err) {
            throw err;
        }
    }
}

module.exports = Balance;