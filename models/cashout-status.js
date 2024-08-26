class NoBalance {
    constructor(residualBalance) {
        this.residualBalance = myUtils.roundToFixed(residualBalance);
    }
}

class OutOfQuota {
    constructor(remainingTime) {
        this.remainingTime = remainingTime;
    }
}

class CashoutSuccess {
    constructor(balanceTaken, remainingBalance) {
        this.balanceTaken = myUtils.roundToFixed(balanceTaken);
        this.remainingBalance = myUtils.roundToFixed(remainingBalance);
    }
}

module.exports = { OutOfQuota, NoBalance, CashoutSuccess };