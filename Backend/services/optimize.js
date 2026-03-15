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
 * Generates all possible combinations of 'k' elements from an array.
 * @param {Array} array - The source array (e.g., the user's rack)
 * @param {number} k - The number of items to pick
 * @returns {Array} An array of combination arrays
 */
const getCombinations = (array, k) => {
  // Base Case 1: If we want to pick 0 items, there is exactly one way to do that (an empty set)
  if (k === 0) return [[]];
  
  // Base Case 2: If we want to pick the exact number of items we have, return the whole array
  if (k === array.length) return [array];
  
  // Base Case 3: We can't pick more items than we have
  if (k > array.length) return [];

  const result = [];

  // Recursive Step: Lock in one item, and combine it with combinations of the remaining items
  for (let i = 0; i <= array.length - k; i++) {
    const fixedElement = array[i];
    
    // Pass the REST of the array forward, and ask for k - 1 combinations
    const tailCombinations = getCombinations(array.slice(i + 1), k - 1);
    
    // Attach our locked element to the front of every combination returned
    for (const combo of tailCombinations) {
      result.push([fixedElement, ...combo]);
    }
  }

  return result;
};


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
  
  // 1. THE MELTDOWN: Destroy the board and turn it into a single pool of tiles.
  // Tag each tile with its source so the move reconstructor can read it directly.
  const boardPool = board.flatMap((group, gi) =>
    group.map(tile => ({ ...tile, _source: 'board', _sourceGroupIndex: gi }))
  );
  console.log('[optimize] findOptimalMove:boardPoolReady', {
    boardPoolSize: boardPool.length
  });

  // 2. TOP-DOWN LOOP: Try using 14 rack tiles, then 13, then 12...
  for (let k = rack.length; k > 0; k--) {
    const elapsedMs = Date.now() - startTime;
    
    // Time Check! If we are out of time, stop searching completely.
    if (elapsedMs > timeLimitMs) {
      console.warn('[optimize] findOptimalMove:timeLimitReached', {
        elapsedMs,
        k
      });
      break; 
    }

    // Generate all possible ways to pick 'k' tiles from the rack
    const rackCombinations = getCombinations(rack, k);
    console.log('[optimize] findOptimalMove:testingK', {
      k,
      combinationCount: rackCombinations.length,
      elapsedMs
    });

    for (let comboIndex = 0; comboIndex < rackCombinations.length; comboIndex++) {
      const rackCombo = rackCombinations[comboIndex];
      // Create our test universe: The whole board + this specific combination of rack tiles.
      // Tag rack tiles so attribution is unambiguous.
      const taggedRackCombo = rackCombo.map(tile => ({ ...tile, _source: 'rack' }));
      const testPool = [...boardPool, ...taggedRackCombo];

      // 3. THE BACKTRACKING ENGINE: Can this exact pool be split into valid sets?
      const resultBoard = solveExactCover(testPool, startTime, timeLimitMs);

      // 4. SHORT-CIRCUIT: Because we started from the highest 'k', the first success
      // is mathematically guaranteed to be the maximum possible tiles played!
      if (resultBoard) {
        console.log('[optimize] findOptimalMove:solutionFound', {
          k,
          comboIndex,
          totalCombinationsForK: rackCombinations.length,
          resultGroups: resultBoard.length,
          elapsedMs: Date.now() - startTime
        });
        return {
          success: true,
          tilesUsed: k,
          rackTilesPlayed: rackCombo,
          finalBoard: resultBoard
        };
      }
    }

    console.log('[optimize] findOptimalMove:noSolutionForK', {
      k,
      testedCombinations: rackCombinations.length,
      elapsedMs: Date.now() - startTime
    });
  }

  // If we get here, no valid moves were found with the given rack
  console.warn('[optimize] findOptimalMove:noMoveFound', {
    elapsedMs: Date.now() - startTime
  });
  return { success: false, message: "No valid moves found. Draw a tile." };
};

/**
 * Optimized Backtracking Solver for Rummikub (Joker Support)
 */
const solveExactCover = (remainingPool, startTime, timeLimitMs, currentBoard = []) => {
  // Base Case: If the pool is completely empty, we won!
  if (remainingPool.length === 0) {
    return currentBoard; 
  }

  // Safety Net: Time limit check
  if (Date.now() - startTime > timeLimitMs) return null;

  // 1. SEPARATE JOKERS FROM REGULAR TILES
  const regularTiles = remainingPool.filter(t => !isJoker(t));
  const jokersAvailable = remainingPool.filter(t => isJoker(t)).length;

  // Edge case: If we only have Jokers left, but no regular tiles, 
  // it's an invalid state (you can't play a Joker by itself).
  if (regularTiles.length === 0 && jokersAvailable > 0) return null;

  // 2. THE TARGET TILE OPTIMIZATION
  // We pick exactly ONE tile that MUST be used in this step. 
  // This completely eliminates checking duplicate branches!
  const targetTile = regularTiles[0];

  // 3. GENERATE SETS FOR THIS SPECIFIC TILE
  // We pass the jokersAvailable count so the generator knows if it can use wildcards
  const possibleSets = generateValidSetsForTarget(targetTile, remainingPool, jokersAvailable);

  // If this specific tile cannot be placed into ANY valid set, the board is dead.
  // We don't need to check the other tiles. Backtrack immediately!
  if (possibleSets.length === 0) {
    return null; 
  }

  // 4. RECURSIVE STEP
  for (const set of possibleSets) {
    
    // Remove the tiles (including the Jokers) used in this set from the pool
    const newPool = removeTilesFromPool(remainingPool, set);
    
    const result = solveExactCover(
      newPool, 
      startTime, 
      timeLimitMs, 
      [...currentBoard, set]
    );

    if (result) return result;
  }

  return null;
};

/**
 * Safely removes a specific set of tiles from the available pool.
 * @param {Array} pool - The current available tiles.
 * @param {Array} set - The valid Rummikub set to remove.
 * @returns {Array} A new array of the remaining tiles.
 */
const removeTilesFromPool = (pool, set) => {
  // 1. Create a shallow clone of the pool so we don't mutate the backtracking state
  const remainingPool = [...pool];

  // 2. Loop through every tile we need to remove
  for (const tileToRemove of set) {
    let indexToRemove = -1;

    if (isJoker(tileToRemove)) {
      // THE JOKER FIX: If the set needs a Joker (even if it's disguised as a Red 5),
      // we must find and remove a raw Joker from the pool.
      indexToRemove = remainingPool.findIndex(t => isJoker(t) === true || (t.isJoker === true)); // Support both boolean and explicit isJoker property
    } else {
      // REGULAR TILE: Find the exact matching color and number.
      // We explicitly check !t.isJoker so we don't accidentally delete a Joker.
      indexToRemove = remainingPool.findIndex(t => 
        (!isJoker(t) || t.isJoker !== true) && 
        t.color === tileToRemove.color && 
        t.number === tileToRemove.number
      );
    }

    // 3. Remove the tile if we found it
    if (indexToRemove !== -1) {
      remainingPool.splice(indexToRemove, 1);
    } else {
      // Safety net: This should never trigger if your set generator is mathematically perfect
      console.error("Critical Math Error: Tried to remove a tile not in the pool!", tileToRemove);
    }
  }

  // 4. Return the new, smaller pool to pass down to the next recursive step
  return remainingPool;
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
