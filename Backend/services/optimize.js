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
const findOptimalMove = (board, rack, timeLimitMs = 2500) => {

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

  const startTime = Date.now();
  
  // 1. THE MELTDOWN: Destroy the board and turn it into a single pool of tiles
  const boardPool = board.flat();

  // 2. TOP-DOWN LOOP: Try using 14 rack tiles, then 13, then 12...
  for (let k = rack.length; k > 0; k--) {
    
    // Time Check! If we are out of time, stop searching completely.
    if (Date.now() - startTime > timeLimitMs) {
      console.log(`[Solver] Time limit reached! Bailing out at k=${k}`);
      break; 
    }

    // Generate all possible ways to pick 'k' tiles from the rack
    const rackCombinations = getCombinations(rack, k);

    for (const rackCombo of rackCombinations) {
      // Create our test universe: The whole board + this specific combination of rack tiles
      const testPool = [...boardPool, ...rackCombo];

      // 3. THE BACKTRACKING ENGINE: Can this exact pool be split into valid sets?
      const resultBoard = solveExactCover(testPool, startTime, timeLimitMs);

      // 4. SHORT-CIRCUIT: Because we started from the highest 'k', the first success
      // is mathematically guaranteed to be the maximum possible tiles played!
      if (resultBoard) {
        return {
          success: true,
          tilesUsed: k,
          rackTilesPlayed: rackCombo,
          finalBoard: resultBoard
        };
      }
    }
  }

  // If we get here, no valid moves were found with the given rack
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
      indexToRemove = remainingPool.findIndex(t => isJoker(t) === true);
    } else {
      // REGULAR TILE: Find the exact matching color and number.
      // We explicitly check !t.isJoker so we don't accidentally delete a Joker.
      indexToRemove = remainingPool.findIndex(t => 
        !isJoker(t) && 
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
  const COLORS = ['red', 'blue', 'black', 'yellow'];
  const { color: tColor, number: tNumber } = targetTile;

  // 1. CREATE A FAST-LOOKUP INVENTORY
  // Instead of using .find() a thousand times, we map the pool to a dictionary.
  const poolInventory = {};
  pool.forEach(t => {
    if (!isJoker(t)) {
      const key = `${t.color}_${t.number}`;
      poolInventory[key] = (poolInventory[key] || 0) + 1;
    }
  });

  // We must deduct the targetTile itself from the inventory so we don't accidentally use it twice
  poolInventory[`${tColor}_${tNumber}`]--;

  // ==========================================
  // LOGIC BLOCK 1: GENERATE GROUPS (Same Number, Different Colors)
  // A valid group is 3 or 4 tiles. 
  // ==========================================
  
  // Find the colors we don't have yet
  const otherColors = COLORS.filter(c => c !== tColor);

  // All mathematically possible color combinations to finish a group of 3 or 4
  const groupCombinations = [
    [otherColors[0], otherColors[1]],                 // 3-tile group option A
    [otherColors[0], otherColors[2]],                 // 3-tile group option B
    [otherColors[1], otherColors[2]],                 // 3-tile group option C
    [otherColors[0], otherColors[1], otherColors[2]]  // 4-tile group (All colors)
  ];

  for (const combo of groupCombinations) {
    let jokersNeeded = 0;
    const currentGroup = [targetTile]; // The target tile anchors the group

    for (const neededColor of combo) {
      const key = `${neededColor}_${tNumber}`;
      
      if (poolInventory[key] > 0) {
        // We have the real tile in our pool!
        currentGroup.push({ color: neededColor, number: tNumber, isJoker: false });
      } else {
        // We are missing the tile. We must spend a Joker and disguise it!
        jokersNeeded++;
        currentGroup.push({ color: neededColor, number: tNumber, isJoker: true });
      }
    }

    // If we have enough Jokers in our hand to bridge the gaps, this group is valid!
    if (jokersNeeded <= jokersAvailable) {
      validSets.push(currentGroup);
    }
  }

  // ==========================================
  // LOGIC BLOCK 2: GENERATE RUNS (Same Color, Consecutive Numbers)
  // A valid run is 3 to 13 tiles long.
  // ==========================================

  // We test every possible starting point and ending point for a run
  // that could possibly wrap around our target tile.
  for (let start = 1; start <= tNumber; start++) {
    for (let end = Math.max(start + 2, tNumber); end <= 13; end++) {
      
      let jokersNeeded = 0;
      const currentRun = [];

      for (let v = start; v <= end; v++) {
        if (v === tNumber) {
          // It's our target tile! We already have it.
          currentRun.push(targetTile);
        } else {
          // Check if we have this specific number in our inventory
          const key = `${tColor}_${v}`;
          if (poolInventory[key] > 0) {
             currentRun.push({ color: tColor, number: v, isJoker: false });
          } else {
             jokersNeeded++;
             currentRun.push({ color: tColor, number: v, isJoker: true });
          }
        }
      }

      // If we didn't exceed our Joker limit, this is a mathematically valid run
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
