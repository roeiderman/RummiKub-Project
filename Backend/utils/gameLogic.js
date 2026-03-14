
/**
 * Returns true if a tile is a Joker, regardless of how the client encoded it.
 * Detection model uses number="Joker"; edit screens use number="0".
 */
function isJoker(tile) {
    return tile.number === 'Joker'
        || tile.number === 'joker'
        || tile.number === '0'
        || (tile.tile && tile.tile.toLowerCase().includes('joker'));
}

/**
 * Check if a group of tiles forms a valid run
 * Run: 3+ tiles with same color and sequential numbers
 * Jokers can fill gaps in the sequence
 */
function isValidRun(tiles) {
    if (!tiles || tiles.length < 3) return false;

    // Separate Jokers from regular tiles
    const jokers = tiles.filter(t => isJoker(t));
    const regularTiles = tiles.filter(t => !isJoker(t));

    // Need at least 2 regular tiles to determine color and sequence
    if (regularTiles.length < 2) return false;

    // Check all regular tiles have same color
    const color = regularTiles[0].color;
    if (!regularTiles.every(t => t.color === color)) return false;

    // Parse and sort regular tile numbers
    const numbers = regularTiles.map(t => {
        const num = parseInt(t.number);
        return isNaN(num) ? null : num;
    }).filter(n => n !== null);

    if (numbers.length !== regularTiles.length) return false;
    numbers.sort((a, b) => a - b);

    // Check for duplicates in regular tiles
    for (let i = 0; i < numbers.length - 1; i++) {
        if (numbers[i] === numbers[i + 1]) return false;
    }

    // Calculate gaps in sequence
    const minNum = numbers[0];
    const maxNum = numbers[numbers.length - 1];
    const expectedLength = maxNum - minNum + 1;
    const gapsCount = expectedLength - numbers.length;

    // Check if we have enough Jokers to fill gaps
    // (Extra jokers can extend the sequence)
    if (jokers.length < gapsCount) return false;

    // Ensure total run length is valid (3-13 tiles in Rummikub)
    const totalLength = regularTiles.length + jokers.length;
    return totalLength >= 3 && totalLength <= 13;
}

/**
 * Check if a group of tiles forms a valid set
 * Set: 3-4 tiles with same number and different colors
 * Jokers can substitute for any missing color
 */
function isValidSet(tiles) {
    if (!tiles || tiles.length < 3 || tiles.length > 4) return false;

    // Separate Jokers from regular tiles
    const jokers = tiles.filter(t => isJoker(t));
    const regularTiles = tiles.filter(t => !isJoker(t));

    // Need at least 2 regular tiles to determine number
    if (regularTiles.length < 2) return false;

    // Check all regular tiles have same number
    const number = regularTiles[0].number;
    if (!regularTiles.every(t => t.number === number)) return false;

    // Check all regular tiles have different colors
    const colors = regularTiles.map(t => t.color);
    const uniqueColors = new Set(colors);
    if (uniqueColors.size !== regularTiles.length) return false;

    // Valid colors in Rummikub (Yellow normalized to Orange at detection)
    const validColors = new Set(['Red', 'Blue', 'Black', 'Orange']);
    if (!colors.every(c => validColors.has(c))) return false;

    // Total tiles (regular + jokers) must be 3-4
    const totalTiles = regularTiles.length + jokers.length;
    if (totalTiles < 3 || totalTiles > 4) return false;

    // Can't have more jokers than missing colors
    const maxColors = 4; // Red, Blue, Black, Orange/Yellow
    const maxJokers = maxColors - regularTiles.length;
    if (jokers.length > maxJokers) return false;

    return true;
}

// /**
//  * Detect and validate all series in an array of tiles
//  * @param {Array} tiles - Array of detected tiles
//  * @param {Object} options - Options for detection
//  * @returns {Array} Array of series objects
//  */
// function detectSeries(groups) {
//     // Analyze each group
//     const series = [];
//     let seriesId = 0;

//     for (const group of groups) {
//         // Skip single tiles
//         if (group.length < 3) continue;

//         // Try to validate as run
//         const isRun = isValidRun(group);

//         // Try to validate as set
//         const isSet = isValidSet(group);

//         // Debug logging for groups that fail validation
//         if (!isRun && !isSet && group.length >= 3) {
//             console.log('⚠️  Series validation failed:', {
//                 tiles: group.map(t => `${t.color}_${t.number}`),
//                 groupSize: group.length,
//                 colors: [...new Set(group.map(t => t.color))],
//                 numbers: [...new Set(group.map(t => t.number))]
//             });
//         }

//         if (isRun || isSet) {
//             // Sort tiles for consistent ordering
//             const sortedTiles = [...group].sort((a, b) => {
//                 if (isRun) {
//                     // For runs, Jokers should be positioned by their gap location
//                     // For now, put Jokers after regular tiles in sorted order
//                     const aNum = a.number === 'Joker' || a.number === 'joker' ? Infinity : parseInt(a.number);
//                     const bNum = b.number === 'Joker' || b.number === 'joker' ? Infinity : parseInt(b.number);
//                     return aNum - bNum;
//                 } else {
//                     // For sets, Jokers go at the end
//                     const aIsJoker = a.number === 'Joker' || a.number === 'joker';
//                     const bIsJoker = b.number === 'Joker' || b.number === 'joker';
//                     if (aIsJoker && !bIsJoker) return 1;
//                     if (!aIsJoker && bIsJoker) return -1;
//                     return a.color.localeCompare(b.color);
//                 }
//             });

//             const seriesObj = {
//                 id: seriesId++,
//                 type: isRun ? 'run' : 'set',
//                 isValid: true,
//                 tiles: sortedTiles.map(t => t.id),
//                 boundingBox: calculateBoundingBox(sortedTiles)
//             };

//             if (isRun) {
//                 // For runs, need to extract color from regular tiles (Jokers may have any color)
//                 const regularTiles = sortedTiles.filter(t => t.number !== 'Joker' && t.number !== 'joker');
//                 const jokerTiles = sortedTiles.filter(t => t.number === 'Joker' || t.number === 'joker');

//                 const regularTile = regularTiles[0];
//                 seriesObj.color = regularTile ? regularTile.color : sortedTiles[0].color;

//                 // Extract and sort regular numbers
//                 const regularNumbers = regularTiles.map(t => parseInt(t.number)).sort((a, b) => a - b);

//                 // Build complete sequence including Joker placeholders
//                 const fullSequence = [];
//                 if (regularNumbers.length > 0) {
//                     const minNum = regularNumbers[0];
//                     const maxNum = regularNumbers[regularNumbers.length - 1];
//                     let jokerIndex = 0;

//                     // Fill sequence from min to max, marking Jokers in gaps
//                     for (let i = minNum; i <= maxNum; i++) {
//                         if (regularNumbers.includes(i)) {
//                             fullSequence.push(i);
//                         } else {
//                             // This position is a gap, filled by a Joker
//                             const joker = jokerTiles[jokerIndex++];
//                             fullSequence.push(`${joker.color}_Joker`);
//                         }
//                     }

//                     // Add any remaining Jokers at the end (extending the sequence)
//                     while (jokerIndex < jokerTiles.length) {
//                         const joker = jokerTiles[jokerIndex++];
//                         fullSequence.push(`${joker.color}_Joker`);
//                     }
//                 }
//                 seriesObj.numbers = fullSequence;
//             } else {
//                 // For sets, show regular number and mark Jokers in colors
//                 const regularTiles = sortedTiles.filter(t => t.number !== 'Joker' && t.number !== 'joker');
//                 const jokerTiles = sortedTiles.filter(t => t.number === 'Joker' || t.number === 'joker');

//                 seriesObj.number = regularTiles[0] ? regularTiles[0].number : sortedTiles[0].number;
//                 seriesObj.colors = sortedTiles.map(t => {
//                     if (t.number === 'Joker' || t.number === 'joker') {
//                         return `${t.color}_Joker`;
//                     }
//                     return t.color;
//                 });
//             }

//             series.push(seriesObj);
//         }
//     }

//     // Log validation summary
//     const invalidGroups = groups.filter(g => g.length >= 3 && !series.some(s => s.tiles.some(tId => g.some(t => t.id === tId)))).length;
//     console.log(`✓ Valid series: ${series.length}, ✗ Invalid groups: ${invalidGroups}`);

//     return series;
// }




module.exports = {
    isJoker,
    isValidRun,
    isValidSet,
    //detectSeries,
};
