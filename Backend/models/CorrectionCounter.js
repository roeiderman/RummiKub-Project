const mongoose = require('mongoose');

const correctionCounterSchema = new mongoose.Schema({
    count: { type: Number, default: 0 },
    fileIndex: { type: Number, default: 4999 } // starts at 4999 so first increment gives tiles5000
});

module.exports = mongoose.model('CorrectionCounter', correctionCounterSchema);
