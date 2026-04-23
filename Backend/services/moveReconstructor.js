/**
 * Move Reconstructor Service
 * Given initialBoard, rackTilesPlayed, and finalBoard (from the optimizer),
 * produces an ordered sequence of human-readable moves the player must execute.
 *
 * Attribution is trivial because the optimizer tags every tile in finalBoard
 * with _source ('rack' | 'board') and _sourceGroupIndex (board tiles only).
 */

const { isJoker } = require('../utils/gameLogic');

/**
 * Reads source attribution directly from the _source / _sourceGroupIndex tags
 * that the optimizer stamped onto every tile.
 * @returns {Array<Array<{tile, source, sourceGroupIndex?}>>}
 */
function readAttributions(finalBoard) {
    return finalBoard.map(group =>
        group.map(tile => ({
            tile,
            source: tile._source || 'unknown',
            sourceGroupIndex: tile._sourceGroupIndex != null ? tile._sourceGroupIndex : undefined
        }))
    );
}

/**
 * Classifies a single final group based on where its tiles came from.
 *
 * Move types:
 *   UNCHANGED               - all tiles from one board group, none from rack, no split
 *   CREATE_GROUP_FROM_RACK  - all tiles from rack
 *   PLACE_FROM_RACK_TO_EXISTING - one board source + rack tiles
 *   MOVE_TILE_ON_BOARD      - multiple board sources, no rack tiles
 *   CREATE_GROUP_FROM_BOARD - single board source (partial extraction), no rack
 *   EXTEND_GROUP            - multiple board sources + rack tiles
 */
function classifyGroup(attribution, initialBoard) {
    const rackTiles  = attribution.filter(a => a.source === 'rack');
    const boardTiles = attribution.filter(a => a.source === 'board');

    const hasRack  = rackTiles.length > 0;
    const hasBoard = boardTiles.length > 0;

    const sourceGroupIndices = [
        ...new Set(boardTiles.map(a => a.sourceGroupIndex).filter(i => i != null))
    ];

    // All from rack
    if (!hasBoard && hasRack) {
        return { type: 'CREATE_GROUP_FROM_RACK', sourceGroupIndex: 'rack' };
    }

    // Rack + board tiles
    if (hasBoard && hasRack) {
        if (sourceGroupIndices.length === 1) {
            return { type: 'PLACE_FROM_RACK_TO_EXISTING', sourceGroupIndex: sourceGroupIndices[0] };
        }
        return { type: 'EXTEND_GROUP', sourceGroupIndex: sourceGroupIndices };
    }

    // Only board tiles
    if (hasBoard && !hasRack) {
        if (sourceGroupIndices.length > 1) {
            return { type: 'MOVE_TILE_ON_BOARD', sourceGroupIndex: sourceGroupIndices };
        }

        const sourceIdx = sourceGroupIndices[0];
        if (sourceIdx == null) return { type: 'UNCHANGED' };

        const sourceGroup = initialBoard[sourceIdx];
        // All tiles from that source group ended up here unchanged
        if (sourceGroup && boardTiles.length === sourceGroup.length) {
            return { type: 'UNCHANGED', sourceGroupIndex: sourceIdx };
        }
        // Partial extraction from one board group
        return { type: 'CREATE_GROUP_FROM_BOARD', sourceGroupIndex: sourceIdx };
    }

    return { type: 'UNCHANGED' };
}

/** Returns a display name for a tile */
function tileName(tile) {
    return isJoker(tile) ? 'Joker' : `${tile.color} ${tile.number}`;
}

/** Joins an array of strings naturally: "A", "A and B", "A, B, and C" */
function formatList(items) {
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/**
 * Builds a human-readable description by listing each tile with its exact source.
 * Example: "Take Red_1 and Yellow_1 from your rack, and the Joker from group 0 → create new group"
 */
function buildHumanDescription(attribution) {
    const parts = [];

    // Rack tiles — grouped together
    const rackNames = attribution
        .filter(a => a.source === 'rack')
        .map(a => tileName(a.tile));
    if (rackNames.length > 0) {
        parts.push(`${formatList(rackNames)} from your rack`);
    }

    // Board tiles — grouped by source group index
    const boardByGroup = {};
    attribution
        .filter(a => a.source === 'board')
        .forEach(a => {
            const gi = a.sourceGroupIndex;
            if (!boardByGroup[gi]) boardByGroup[gi] = [];
            boardByGroup[gi].push(tileName(a.tile));
        });
    for (const [gi, names] of Object.entries(boardByGroup)) {
        parts.push(`${formatList(names)} from group ${gi}`);
    }

    return `Take ${formatList(parts)} → create new group`;
}

/**
 * Builds the ordered MoveObject array.
 * Rack moves (CREATE + PLACE) come before board rearrangements.
 */
function buildMoves(finalBoard, attributions, classifications) {
    const RACK_FIRST_TYPES = new Set([
        'CREATE_GROUP_FROM_RACK',
        'PLACE_FROM_RACK_TO_EXISTING'
    ]);

    const rackIndices  = [];
    const boardIndices = [];

    for (let i = 0; i < classifications.length; i++) {
        if (classifications[i].type === 'UNCHANGED') continue;
        if (RACK_FIRST_TYPES.has(classifications[i].type)) {
            rackIndices.push(i);
        } else {
            boardIndices.push(i);
        }
    }

    const moves = [];

    for (const gi of [...rackIndices, ...boardIndices]) {
        const { type, sourceGroupIndex } = classifications[gi];
        const attribution = attributions[gi];
        const tiles = attribution.map(a => a.tile);
        const description = buildHumanDescription(attribution);

        moves.push({
            moveNumber: moves.length + 1,
            type,
            description,
            tiles,
            sourceGroupIndex,
            targetGroupIndex: gi
        });
    }

    return moves;
}

/**
 * Main entry point.
 * @param {Array} initialBoard     - Board state before the move
 * @param {Array} finalBoard       - Optimal board returned by the optimizer (tiles carry _source tags)
 * @returns {Array} Ordered list of MoveObjects
 */
function reconstructMoves(initialBoard, finalBoard) {
    if (!finalBoard || finalBoard.length === 0) return [];

    const attributions = readAttributions(finalBoard);
    const classifications = attributions.map(attr =>
        classifyGroup(attr, initialBoard || [])
    );
    const moves = buildMoves(finalBoard, attributions, classifications);

    console.log('[reconstructMoves] output moves:', JSON.stringify(moves, null, 2));

    return moves;
}

module.exports = { reconstructMoves };
