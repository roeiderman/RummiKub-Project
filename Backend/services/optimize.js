/**
 * Rummikub Optimization Service
 * Handles board validation and move optimization for Rummikub gameplay
 */

const gameLogic = require('../utils/gameLogic');
const { isJoker } = gameLogic;

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
 * Main Optimizer Function
 * @param {Array} board - The current valid groups on the table (e.g., [[1,2,3], [4,4,4]])
 * @param {Array} rack - The user's current rack tiles
 * @param {number} timeLimitMs - Maximum allowed execution time before bailing out
 */
const findOptimalMove = (board, rack, timeLimitMs = 40000) => {
  console.log('[optimize] findOptimalMove:start', {
    boardGroups: Array.isArray(board) ? board.length : null,
    boardTiles: Array.isArray(board) ? board.flat().length : null,
    rackTiles: Array.isArray(rack) ? rack.length : null,
    timeLimitMs
  });

  // Validate the board first
  const boardValidation = validateBoard(board);
  console.log('[optimize] findOptimalMove:boardValidation', {
    valid: boardValidation.valid,
    invalidGroupCount: boardValidation.errors.length,
    validGroupCount: boardValidation.validGroups.length
  });

  if (!boardValidation.valid) {
    console.error('[optimize] findOptimalMove:invalidBoard', {
      errors: boardValidation.errors
    });
    const error = new Error('Invalid board configuration');
    error.statusCode = 400;
    error.type = 'BoardInvalidError';
    error.details = {
      invalidGroups: boardValidation.errors
    };
    throw error;
  }

  const startTime = Date.now();

  // 1. Flatten the board into a mandatory tile pool.
  const boardPool = board.flatMap((group, gi) =>
    group.map(tile => ({ ...tile, _source: 'board', _sourceGroupIndex: gi }))
  );
  const rackPool = rack.map(tile => ({ ...tile, _source: 'rack' }));
  console.log('[optimize] findOptimalMove:boardPoolReady', {
    boardPoolSize: boardPool.length,
    rackPoolSize: rackPool.length
  });

  const best = {
    tilesUsed: -1,
    finalBoard: null,
    rackTilesPlayed: []
  };
  const memo = new Map();

  solveBestArrangement(
    boardPool,
    rackPool,
    startTime,
    timeLimitMs,
    [],
    0,
    best,
    memo
  );

  if (best.finalBoard && best.tilesUsed > 0) {
    console.log('[optimize] findOptimalMove:solutionFound', {
      tilesUsed: best.tilesUsed,
      resultGroups: best.finalBoard.length,
      elapsedMs: Date.now() - startTime
    });
    return {
      success: true,
      tilesUsed: best.tilesUsed,
      rackTilesPlayed: best.rackTilesPlayed,
      finalBoard: best.finalBoard
    };
  }

  console.warn('[optimize] findOptimalMove:noMoveFound', {
    elapsedMs: Date.now() - startTime
  });
  return { success: false, message: "No valid moves found. Draw a tile." };
};

/**
 * Search for the best final arrangement while covering all board tiles and
 * maximizing how many rack tiles are incorporated.
 */
const solveBestArrangement = (
  remainingBoardTiles,
  remainingRackTiles,
  startTime,
  timeLimitMs,
  currentBoard,
  usedRackCount,
  best,
  memo
) => {
  if (Date.now() - startTime > timeLimitMs) {
    return;
  }

  const maxPossibleRackUsage = usedRackCount + remainingRackTiles.length;
  if (maxPossibleRackUsage <= best.tilesUsed) {
    return;
  }

  const stateKey = serializeState(remainingBoardTiles, remainingRackTiles);
  const previousBestForState = memo.get(stateKey);
  if (previousBestForState !== undefined && previousBestForState >= usedRackCount) {
    return;
  }
  memo.set(stateKey, usedRackCount);

  if (remainingBoardTiles.length === 0) {
    if (usedRackCount > best.tilesUsed) {
      best.tilesUsed = usedRackCount;
      best.finalBoard = currentBoard.map(group => [...group]);
      best.rackTilesPlayed = currentBoard
        .flat()
        .filter(tile => tile._source === 'rack');
    }
  }

  const allRemainingTiles = [...remainingBoardTiles, ...remainingRackTiles];
  const targetTile = chooseTargetTile(remainingBoardTiles, remainingRackTiles);
  if (!targetTile) {
    return;
  }

  const jokersAvailable = allRemainingTiles.filter(tile => isJoker(tile)).length;
  const possibleSets = generateValidSetsForTarget(targetTile, allRemainingTiles, jokersAvailable)
    .filter(group => group.length >= 3)
    .sort((a, b) => {
      const rackCountDiff = countRackTiles(b) - countRackTiles(a);
      if (rackCountDiff !== 0) return rackCountDiff;
      return b.length - a.length;
    });

  if (possibleSets.length === 0) {
    return;
  }

  for (const set of possibleSets) {
    const nextState = removeTilesFromPools(remainingBoardTiles, remainingRackTiles, set);
    if (!nextState) continue;

    solveBestArrangement(
      nextState.remainingBoardTiles,
      nextState.remainingRackTiles,
      startTime,
      timeLimitMs,
      [...currentBoard, set],
      usedRackCount + countRackTiles(set),
      best,
      memo
    );
  }
};

/**
 * Prefers covering mandatory board tiles first; once those are all covered,
 * the search can continue with optional rack-only groups if profitable.
 */
const chooseTargetTile = (remainingBoardTiles, remainingRackTiles) => {
  const regularBoardTile = remainingBoardTiles.find(tile => !isJoker(tile));
  if (regularBoardTile) return regularBoardTile;

  if (remainingBoardTiles.length > 0) {
    return remainingRackTiles.find(tile => !isJoker(tile)) || null;
  }

  const regularRackTile = remainingRackTiles.find(tile => !isJoker(tile));
  if (regularRackTile) return regularRackTile;

  return null;
};

const countRackTiles = (group) => group.reduce(
  (count, tile) => count + (tile._source === 'rack' ? 1 : 0),
  0
);

const serializeTileCounts = (tiles) => {
  const counts = new Map();
  for (const tile of tiles) {
    const sourceGroup = tile._source === 'board'
      ? `g${tile._sourceGroupIndex ?? 'x'}`
      : 'rack';
    const key = isJoker(tile)
      ? `${sourceGroup}|Joker`
      : `${sourceGroup}|${tile.color}_${tile.number}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => `${key}:${count}`)
    .join(',');
};

const serializeState = (remainingBoardTiles, remainingRackTiles) =>
  `${serializeTileCounts(remainingBoardTiles)}||${serializeTileCounts(remainingRackTiles)}`;

/**
 * Safely removes a specific set of tiles from the available board/rack pools.
 */
const removeTilesFromPools = (boardTiles, rackTiles, set) => {
  const remainingBoardTiles = [...boardTiles];
  const remainingRackTiles = [...rackTiles];

  for (const tileToRemove of set) {
    const targetPool = tileToRemove._source === 'rack' ? remainingRackTiles : remainingBoardTiles;
    let indexToRemove = targetPool.indexOf(tileToRemove);

    if (indexToRemove === -1) {
      indexToRemove = targetPool.findIndex(tile => {
        if (isJoker(tileToRemove) || isJoker(tile)) {
          return isJoker(tileToRemove) && isJoker(tile);
        }
        return tile.color === tileToRemove.color && tile.number === tileToRemove.number;
      });
    }

    if (indexToRemove === -1) {
      return null;
    }

    targetPool.splice(indexToRemove, 1);
  }

  return { remainingBoardTiles, remainingRackTiles };
};

/**
 * Generates all possible valid Rummikub sets (Runs and Groups) that explicitly 
 * include the targetTile, utilizing available Jokers if necessary.
 * * @param {Object} targetTile - The mandatory tile (e.g., {color: 'red', number: 7, isJoker: false})
 * @param {Array} pool - All currently available tiles
 * @param {number} jokersAvailable - The number of Jokers we are allowed to use
 * @returns {Array} An array of valid sets (each set is an array of tile objects)
 */
const generateValidSetsForTarget = (targetTile, pool, jokersAvailable) => {
  const validSets = [];
  const COLORS = ['Red', 'Blue', 'Black', 'Orange'];
  const { color: tColor, number: tNumber } = targetTile;


  // 1. CREATE A FAST-LOOKUP INVENTORY (count-based, for availability checks)
  const poolInventory = {};
  pool.forEach(t => {
    if (!isJoker(t)) {
      const key = `${t.color}_${t.number}`;
      poolInventory[key] = (poolInventory[key] || 0) + 1;
    }
  });

  // Deduct the targetTile so we don't use it twice
  poolInventory[`${tColor}_${tNumber}`]--;

  // 2. BUILD OBJECT LOOKUP so we return real tile objects (preserving _source tags)
  //    poolByKey[key] = array of actual tile objects with that color+number
  const poolByKey = {};
  const jokerTiles = [];
  pool.forEach(t => {
    if (isJoker(t)) {
      jokerTiles.push(t);
    } else {
      const key = `${t.color}_${t.number}`;
      if (!poolByKey[key]) poolByKey[key] = [];
      poolByKey[key].push(t);
    }
  });

  // Remove targetTile from its own key so it isn't returned as its own neighbor
  const targetKey = `${tColor}_${tNumber}`;
  if (poolByKey[targetKey]) {
    const idx = poolByKey[targetKey].indexOf(targetTile);
    if (idx !== -1) poolByKey[targetKey].splice(idx, 1);
  }

  // Helper: get the real tile object for a slot, falling back to a plain object if missing
  const pickTile = (color, number) => {
    const key = `${color}_${number}`;
    return (poolByKey[key] && poolByKey[key][0]) || { color, number, isJoker: false };
  };
  // Helper: get the real joker tile for a joker slot (jokerIndex tracks usage within this set)
  const pickJoker = (jokerIndex) => jokerTiles[jokerIndex] || { isJoker: true };

  // ==========================================
  // LOGIC BLOCK 1: GENERATE GROUPS (Same Number, Different Colors)
  // ==========================================
  const otherColors = COLORS.filter(c => c !== tColor);
  const groupCombinations = [
    [otherColors[0], otherColors[1]],
    [otherColors[0], otherColors[2]],
    [otherColors[1], otherColors[2]],
    [otherColors[0], otherColors[1], otherColors[2]]
  ];

  for (const combo of groupCombinations) {
    let jokersNeeded = 0;
    const currentGroup = [targetTile];

    for (const neededColor of combo) {
      const key = `${neededColor}_${tNumber}`;
      if (poolInventory[key] > 0) {
        currentGroup.push(pickTile(neededColor, tNumber));
      } else {
        currentGroup.push(pickJoker(jokersNeeded++));
      }
    }

    if (jokersNeeded <= jokersAvailable) {
      validSets.push(currentGroup);
    }
  }

  // ==========================================
  // LOGIC BLOCK 2: GENERATE RUNS (Same Color, Consecutive Numbers)
  // ==========================================
  for (let start = 1; start <= tNumber; start++) {
    for (let end = Math.max(start + 2, tNumber); end <= 13; end++) {
      let jokersNeeded = 0;
      const currentRun = [];

      for (let v = start; v <= end; v++) {
        if (v === tNumber) {
          currentRun.push(targetTile);
        } else {
          const key = `${tColor}_${v}`;
          if (poolInventory[key] > 0) {
            currentRun.push(pickTile(tColor, v));
          } else {
            currentRun.push(pickJoker(jokersNeeded++));
          }
        }
      }

      if (jokersNeeded <= jokersAvailable) {
        validSets.push(currentRun);
      }
    }
  }

  return validSets;
};

module.exports = {
    validateBoard,
    findOptimalMove
};
