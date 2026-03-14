/**
 * LeaderboardStats Model - MongoDB Schema
 * One document per registered user, tracking leaderboard statistics.
 */

const mongoose = require('mongoose');

const leaderboardStatsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true
    },
    totalTurns: {
        type: Number,
        default: 0
    },
    maxTilesInOneTurn: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

leaderboardStatsSchema.index({ maxTilesInOneTurn: -1 });
leaderboardStatsSchema.index({ totalTurns: 1 });

const LeaderboardStats = mongoose.model('LeaderboardStats', leaderboardStatsSchema);

module.exports = LeaderboardStats;
