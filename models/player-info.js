class PlayerInfo {
    constructor({
        player_username,
        player_display_name,
        balance,
        xp,
        rank,
        above_display_name,
        xp_difference,
        above_rank
    }) {
        this.player_username = player_username;
        this.player_display_name = player_display_name;
        this.balance = balance;
        this.xp = xp;
        this.rank = rank;
        this.above_display_name = above_display_name;
        this.xp_difference = xp_difference;
        this.above_rank = above_rank;
    }
}
module.exports = PlayerInfo;