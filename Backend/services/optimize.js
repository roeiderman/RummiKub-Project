/**
 * Rummikub Optimization Service
 * Handles board validation and move optimization for Rummikub gameplay
 */

const gameLogic = require('../utils/gameLogic');

/**
 * Validates that all groups on the board form valid Rummikub series
 * @param {Array} groups - Array of tile groups (each group is an array of tiles)
 * @returns {Object} Validation result with valid flag, errors, and valid groups
 */
function validateBoard(groups) {
    if (!groups || groups.length === 0) {
        return {
            valid: true,
            errors: [],
            validGroups: []
        };
    }

    const errors = [];
    const validGroups = [];

    groups.forEach((group, index) => {
        // Check minimum size requirement
        if (group.length < 3) {
            errors.push({
                groupIndex: index,
                tiles: group.map(t => t.tile || `${t.color}_${t.number}`),
                reason: 'Series requires minimum 3 tiles'
            });
            return;
        }

        // Validate as run or set
        const isRun = gameLogic.isValidRun(group);
        const isSet = gameLogic.isValidSet(group);

        if (!isRun && !isSet) {
            errors.push({
                groupIndex: index,
                tiles: group.map(t => t.tile || `${t.color}_${t.number}`),
                reason: 'Group is neither a valid run nor a valid set'
            });
        } else {
            validGroups.push({
                groupIndex: index,
                type: isRun ? 'run' : 'set',
                tiles: group
            });
        }
    });

    return {
        valid: errors.length === 0,
        errors,
        validGroups
    };
}

/**
 * Tries to extend an existing series with tiles from the rack
 * @param {Array} series - Existing series of tiles
 * @param {Array} rack - Available rack tiles
 * @param {string} seriesType - Type of series ('run' or 'set')
 * @returns {Array} Array of possible extensions
 */
function tryExtendSeries(series, rack, seriesType) {
    const extensions = [];

    if (seriesType === 'run') {
        // For runs: try adding sequential tiles at start or end
        const regularTiles = series.filter(t => t.number !== 'Joker' && t.number !== 'joker');
        if (regularTiles.length === 0) return extensions;

        const color = regularTiles[0].color;
        const numbers = regularTiles.map(t => parseInt(t.number)).sort((a, b) => a - b);
        const minNum = numbers[0];
        const maxNum = numbers[numbers.length - 1];

        // Try extending at the end (maxNum + 1, +2, etc.)
        for (const tile of rack) {
            if (tile.color === color) {
                const num = parseInt(tile.number);
                if (!isNaN(num) && num === maxNum + 1) {
                    const newSeries = [...series, tile];
                    if (gameLogic.isValidRun(newSeries)) {
                        extensions.push({
                            tilesUsed: [tile],
                            newSeries,
                            position: 'end'
                        });
                    }
                }
            }
        }

        // Try extending at the start (minNum - 1, -2, etc.)
        for (const tile of rack) {
            if (tile.color === color) {
                const num = parseInt(tile.number);
                if (!isNaN(num) && num === minNum - 1) {
                    const newSeries = [tile, ...series];
                    if (gameLogic.isValidRun(newSeries)) {
                        extensions.push({
                            tilesUsed: [tile],
                            newSeries,
                            position: 'start'
                        });
                    }
                }
            }
        }
    } else if (seriesType === 'set') {
        // For sets: try adding same number with different color
        const regularTiles = series.filter(t => t.number !== 'Joker' && t.number !== 'joker');
        if (regularTiles.length === 0) return extensions;

        const number = regularTiles[0].number;
        const usedColors = new Set(regularTiles.map(t => t.color));

        // Can't have more than 4 tiles in a set
        if (series.length >= 4) return extensions;

        for (const tile of rack) {
            if (tile.number === number && !usedColors.has(tile.color)) {
                const newSeries = [...series, tile];
                if (gameLogic.isValidSet(newSeries)) {
                    extensions.push({
                        tilesUsed: [tile],
                        newSeries,
                        position: 'any'
                    });
                }
            }
        }
    }

    return extensions;
}

/**
 * Tries to create new series using only rack tiles
 * @param {Array} rack - Available rack tiles
 * @returns {Array} Array of possible new series
 */
function tryCreateNewSeries(rack) {
    const newSeries = [];

    // Try combinations of 3 and 4 tiles
    for (let size = 3; size <= Math.min(4, rack.length); size++) {
        // Generate combinations of 'size' tiles
        const combinations = getCombinations(rack, size);

        for (const combo of combinations) {
            // Check if it forms a valid run
            if (gameLogic.isValidRun(combo)) {
                newSeries.push({
                    tilesUsed: combo,
                    newSeries: combo,
                    type: 'run'
                });
            }
            // Check if it forms a valid set
            else if (gameLogic.isValidSet(combo)) {
                newSeries.push({
                    tilesUsed: combo,
                    newSeries: combo,
                    type: 'set'
                });
            }
        }
    }

    return newSeries;
}

/**
 * Generate all combinations of k elements from array
 * @param {Array} arr - Source array
 * @param {number} k - Number of elements to select
 * @returns {Array} Array of combinations
 */
function getCombinations(arr, k) {
    if (k === 0) return [[]];
    if (k > arr.length) return [];

    const result = [];

    function backtrack(start, current) {
        if (current.length === k) {
            result.push([...current]);
            return;
        }

        for (let i = start; i < arr.length; i++) {
            current.push(arr[i]);
            backtrack(i + 1, current);
            current.pop();
        }
    }

    backtrack(0, []);
    return result;
}

/**
 * Generates all possible moves by extending series or creating new ones
 * @param {Array} groups - Current board state
 * @param {Array} rack - Available rack tiles
 * @param {Array} validGroups - Validated groups with their types
 * @returns {Array} Array of move objects
 */
function generatePossibleMoves(groups, rack, validGroups) {
    const moves = [];

    // Try extending each valid series
    validGroups.forEach(({ groupIndex, type, tiles }) => {
        const extensions = tryExtendSeries(tiles, rack, type);

        extensions.forEach(extension => {
            // Create updated board state
            const updatedGroups = groups.map((g, idx) =>
                idx === groupIndex ? extension.newSeries : g
            );

            // Calculate remaining rack
            const usedTileIds = new Set(extension.tilesUsed.map(t => t.id));
            const remainingRack = rack.filter(t => !usedTileIds.has(t.id));

            moves.push({
                tilesUsed: extension.tilesUsed,
                moveType: 'extend_series',
                seriesIndex: groupIndex,
                newSeries: extension.newSeries,
                updatedGroups,
                remainingRack,
                tilesPlayed: extension.tilesUsed.length
            });
        });
    });

    // Try creating new series from rack
    const newSeriesMoves = tryCreateNewSeries(rack);

    newSeriesMoves.forEach(newSeriesMove => {
        // Add new series to board
        const updatedGroups = [...groups, newSeriesMove.newSeries];

        // Calculate remaining rack
        const usedTileIds = new Set(newSeriesMove.tilesUsed.map(t => t.id));
        const remainingRack = rack.filter(t => !usedTileIds.has(t.id));

        moves.push({
            tilesUsed: newSeriesMove.tilesUsed,
            moveType: 'new_series',
            seriesIndex: null,
            newSeries: newSeriesMove.newSeries,
            seriesType: newSeriesMove.type,
            updatedGroups,
            remainingRack,
            tilesPlayed: newSeriesMove.tilesUsed.length
        });
    });

    return moves;
}

/**
 * Selects the best move from available options
 * @param {Array} moves - Array of possible moves
 * @returns {Object} Best move or empty move if none available
 */
function selectBestMove(moves) {
    if (moves.length === 0) {
        return {
            tilesUsed: [],
            moveType: 'no_move',
            seriesIndex: null,
            newSeries: null,
            updatedGroups: null,
            remainingRack: null,
            tilesPlayed: 0
        };
    }

    // Sort by number of tiles played (descending)
    moves.sort((a, b) => b.tilesPlayed - a.tilesPlayed);

    return moves[0];
}

/**
 * Main function to find the optimal move
 * @param {Array} groups - Current board state as array of tile groups
 * @param {Array} rack - Player's rack tiles
 * @returns {Object} Optimal move with board and rack updates
 */
async function findOptimalMove(groups, rack) {
    // Validate the board first
    const boardValidation = validateBoard(groups);

    if (!boardValidation.valid) {
        const error = new Error('Invalid board configuration');
        error.statusCode = 400;
        error.type = 'BoardInvalidError';
        error.details = {
            invalidGroups: boardValidation.errors
        };
        throw error;
    }

    // Handle empty rack case ***********************
    if (!rack || rack.length === 0) {
        return {
            boardValid: true,
            optimalMove: {
                tilesUsed: [],
                moveType: 'no_move',
                seriesIndex: null,
                newSeries: null
            },
            tilesPlayed: 0,
            updatedGroups: groups,
            remainingRack: []
        };
    }

    // Generate all possible moves
    const possibleMoves = generatePossibleMoves(groups, rack, boardValidation.validGroups);

    // Select the best move
    const bestMove = selectBestMove(possibleMoves);

    // Return result
    return {
        boardValid: true,
        optimalMove: {
            tilesUsed: bestMove.tilesUsed,
            moveType: bestMove.moveType,
            seriesIndex: bestMove.seriesIndex,
            newSeries: bestMove.newSeries,
            seriesType: bestMove.seriesType || null
        },
        tilesPlayed: bestMove.tilesPlayed,
        updatedGroups: bestMove.updatedGroups || groups,
        remainingRack: bestMove.remainingRack || rack
    };
}

module.exports = {
    validateBoard,
    findOptimalMove,
    tryExtendSeries,
    tryCreateNewSeries,
    generatePossibleMoves,
    selectBestMove
};
