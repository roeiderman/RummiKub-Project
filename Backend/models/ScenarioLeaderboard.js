/**
 * ScenarioLeaderboard Model - MongoDB Schema
 * One document per scenario — contains an embedded array of all player entries.
 */

const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema({
    email:     { type: String, required: true },
    bestScore: { type: Number, required: true },
    attempts:  { type: Number, default: 1 },
    achievedAt:{ type: Date,   default: Date.now },
}, { _id: false });

const scenarioLeaderboardSchema = new mongoose.Schema({
    scenarioId: { type: String, required: true, unique: true },
    entries:    { type: [entrySchema], default: [] },
});

const ScenarioLeaderboard = mongoose.model('ScenarioLeaderboard', scenarioLeaderboardSchema);

module.exports = ScenarioLeaderboard;
