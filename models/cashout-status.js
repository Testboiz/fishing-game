const myUtils = require("../utils");

/**
 * The failed cashout status of lacking a balance (less than 1 Linden to cashout)
 * @property {string} residualBalance Their residual balance (fewer than 1 Linden) on their account
 * @class NoBalance
 */
class NoBalance {
    constructor(residualBalance) {
        this.residualBalance = myUtils.roundToFixed(residualBalance);
    }
}

/**
 * The failed cashout status of not having enough quota (reached the limit)
 * @property {string} remainingTime The hh:mm:ss remaining time for the cashout to be available again
 * @class NoBalance
 */
class OutOfQuota {
    constructor(remainingTime) {
        this.remainingTime = remainingTime;
    }
}

/**
 * The successful cashout status of 
 * @property {number} balanceTaken the balance that is successfully cashed out
 * @property {number} remainingBalance the remaining balance on the player account
 * @class NoBalance
 */
class CashoutSuccess {
    constructor(balanceTaken, remainingBalance) {
        this.balanceTaken = myUtils.roundToFixed(balanceTaken);
        this.remainingBalance = myUtils.roundToFixed(remainingBalance);
    }
}

module.exports = { OutOfQuota, NoBalance, CashoutSuccess };