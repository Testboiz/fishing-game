/**
 * Represents the player info and its rank
 * @property {string} player_uuid The uuid of the player
 * @property {string} player_username the unique username of the player, for in game identification only
 * @property {string} player_display_name the display name of a player, for customization purposes
 * @property {number} balance The balance of the player
 * @property {number} xp The xp of the player
 * @property {number} rank The rank of the player
 * @property {string} above_display_name The display name of someone having higher rank than the player
 * @property {number} xp_difference The xp difference of someone having higher rank than the player
 * @property {number} above_rank The rank of someone having higher rank than the player
 * @class PlayerInfo
 */
class PlayerInfo {
    constructor({
        player_uuid,
        player_username,
        player_display_name,
        balance,
        xp,
        rank,
        above_display_name,
        xp_difference,
        above_rank
    }) {
        this.player_uuid = player_uuid;
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