
/**
 * Returns true if a tile is a Joker, regardless of how the client encoded it.
 * Handles all known encodings:
 *   number: "Joker" | "joker" | "0" | 0 | null
 *   isJoker: true
 *   tile: "...joker..." (string containing "joker")
 */
function isJoker(tile) {
    return tile.number === 'Joker'
        || tile.number === 'joker'
        || tile.number === '0'
        || tile.number === 0
        || tile.number === null
        || tile.isJoker
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

    // Check all regular tiles have same number (normalize to int to handle "5" vs 5)
    const number = parseInt(regularTiles[0].number);
    if (isNaN(number)) return false;
    if (!regularTiles.every(t => parseInt(t.number) === number)) return false;

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



module.exports = {
    isJoker,
    isValidRun,
    isValidSet,
    //detectSeries,
};
