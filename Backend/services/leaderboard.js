/**
 * Leaderboard Service - Business Logic
 */

const LeaderboardStats = require('../models/LeaderboardStats');
const User = require('../models/User');

/**
 * Create a leaderboard entry for a newly registered user.
 */
const createEntry = async (userId, email) => {
    await LeaderboardStats.create({ userId, email });
};

/**
 * Record a turn for a user.
 * Increments totalTurns and updates maxTilesInOneTurn if tilesPlayed is a new personal best.
 */
const recordTurn = async (userId, tilesPlayed) => {
    await LeaderboardStats.findOneAndUpdate(
        { userId },
        {
            $inc: { totalTurns: 1 },
            $max: { maxTilesInOneTurn: tilesPlayed }
        }
    );
};

/**
 * Get leaderboard entries sorted by the given field.
 * sortBy: 'maxTilesInOneTurn' (desc) | 'totalTurns' (desc)
 */
const getLeaderboard = async (sortBy = 'maxTilesInOneTurn') => {
    const allowedSortFields = ['maxTilesInOneTurn', 'totalTurns'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'maxTilesInOneTurn';

    const entries = await LeaderboardStats.find({})
        .sort({ [sortField]: -1 })
        .limit(50)
        .select('email totalTurns maxTilesInOneTurn -_id')
        .lean();

    const emails = entries.map(e => e.email);
    const users = await User.find({ email: { $in: emails } }, 'name email').lean();
    const nameByEmail = Object.fromEntries(users.map(u => [u.email, u.name]));

    return entries.map(e => ({ name: nameByEmail[e.email] ?? e.email, totalTurns: e.totalTurns, maxTilesInOneTurn: e.maxTilesInOneTurn }));
};

/**
 * Update email in leaderboard when a user changes their email.
 */
const updateEmail = async (userId, email) => {
    await LeaderboardStats.findOneAndUpdate({ userId }, { email });
};

module.exports = {
    createEntry,
    recordTurn,
    getLeaderboard,
    updateEmail
};
