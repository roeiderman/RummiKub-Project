/**
 * Rummikub Game Logic Utility
 * Handles series detection and validation for Rummikub tiles
 */

/**
 * Calculate Euclidean distance between two tiles
 */
function calculateDistance(tile1, tile2) {
    const dx = tile1.position.x - tile2.position.x;
    const dy = tile1.position.y - tile2.position.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate optimal threshold based on tile density and spatial distribution
 * @param {Array} tiles - Array of detected tiles
 * @param {number} imageWidth - Image width in pixels
 * @param {number} imageHeight - Image height in pixels
 * @returns {number} Calculated threshold in pixels
 */
function calculateOptimalThreshold(tiles, imageWidth, imageHeight) {
    if (!tiles || tiles.length < 3) return 110; // Default for small samples

    // Calculate average nearest-neighbor distance
    let totalNNDistance = 0;
    for (const tile of tiles) {
        let minDist = Infinity;
        for (const other of tiles) {
            if (tile.id !== other.id) {
                const dist = calculateDistance(tile, other);
                if (dist < minDist) minDist = dist;
            }
        }
        totalNNDistance += minDist;
    }
    const avgNNDistance = totalNNDistance / tiles.length;

    // Calculate tile density
    const imageArea = imageWidth * imageHeight;
    const density = tiles.length / imageArea;

    // Base threshold: 1.8 * average nearest-neighbor distance
    let calculatedThreshold = avgNNDistance * 1.8;

    // Apply density-based bounds
    if (density > 0.00015) { // Very dense (like tile0509)
        calculatedThreshold = Math.max(60, Math.min(calculatedThreshold, 85));
    } else if (density > 0.00008) { // Medium density
        calculatedThreshold = Math.max(70, Math.min(calculatedThreshold, 100));
    } else { // Sparse/scattered (like tile0506, tile0508)
        calculatedThreshold = Math.max(80, Math.min(calculatedThreshold, 180));
    }

    const category = density > 0.00015 ? 'Very dense' : density > 0.00008 ? 'Medium' : 'Sparse';
    console.log(`🔧 Threshold calculation:
  Avg NN distance: ${avgNNDistance.toFixed(1)}px
  Base (1.8 * avg): ${(avgNNDistance * 1.8).toFixed(1)}px
  Density: ${(density * 1000000).toFixed(2)}/M pixels
  Category: ${category}
  Final threshold: ${calculatedThreshold.toFixed(1)}px`);

    return Math.round(calculatedThreshold);
}

/**
 * Group tiles by spatial proximity using distance-based clustering
 * @param {Array} tiles - Array of detected tiles
 * @param {number} threshold - Maximum distance for tiles to be in same group (null for auto-calculate)
 * @param {number} imageWidth - Image width in pixels (required for auto-calculate)
 * @param {number} imageHeight - Image height in pixels (required for auto-calculate)
 * @returns {Array} Array of tile groups
 */
function groupTilesBySpatialProximity(tiles, threshold = null, imageWidth = null, imageHeight = null) {
    if (!tiles || tiles.length === 0) return [];

    // Auto-calculate threshold if not provided
    if (threshold === null && imageWidth && imageHeight) {
        threshold = calculateOptimalThreshold(tiles, imageWidth, imageHeight);
    } else if (threshold === null) {
        threshold = 110; // Fallback to original default
    }

    const visited = new Set();
    const groups = [];

    // Helper function to find all neighbors within threshold
    function findNeighbors(tile, allTiles, threshold) {
        const neighbors = [];
        for (const other of allTiles) {
            if (tile.id !== other.id && !visited.has(other.id)) {
                const distance = calculateDistance(tile, other);
                if (distance <= threshold) {
                    neighbors.push(other);
                }
            }
        }
        return neighbors;
    }

    // DFS to build connected components
    function buildGroup(startTile, allTiles) {
        const group = [];
        const stack = [startTile];
        visited.add(startTile.id);

        while (stack.length > 0) {
            const current = stack.pop();
            group.push(current);

            const neighbors = findNeighbors(current, allTiles, threshold);
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    stack.push(neighbor);
                }
            }
        }

        return group;
    }

    // Build all groups
    for (const tile of tiles) {
        if (!visited.has(tile.id)) {
            const group = buildGroup(tile, tiles);
            if (group.length > 0) {
                groups.push(group);
            }
        }
    }

    return groups;
}

/**
 * Check if a group of tiles forms a valid run
 * Run: 3+ tiles with same color and sequential numbers
 * Jokers can fill gaps in the sequence
 */
function isValidRun(tiles) {
    if (!tiles || tiles.length < 3) return false;

    // Separate Jokers from regular tiles
    const jokers = tiles.filter(t => t.number === 'Joker' || t.number === 'joker');
    const regularTiles = tiles.filter(t => t.number !== 'Joker' && t.number !== 'joker');

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
    if (jokers.length !== gapsCount) return false;

    // Final length must be >= 3
    return (regularTiles.length + jokers.length) >= 3;
}

/**
 * Check if a group of tiles forms a valid set
 * Set: 3-4 tiles with same number and different colors
 * Jokers can substitute for any missing color
 */
function isValidSet(tiles) {
    if (!tiles || tiles.length < 3 || tiles.length > 4) return false;

    // Separate Jokers from regular tiles
    const jokers = tiles.filter(t => t.number === 'Joker' || t.number === 'joker');
    const regularTiles = tiles.filter(t => t.number !== 'Joker' && t.number !== 'joker');

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

/**
 * Calculate bounding box for a group of tiles
 */
function calculateBoundingBox(tiles) {
    if (!tiles || tiles.length === 0) return null;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const tile of tiles) {
        minX = Math.min(minX, tile.position.x);
        maxX = Math.max(maxX, tile.position.x);
        minY = Math.min(minY, tile.position.y);
        maxY = Math.max(maxY, tile.position.y);
    }

    return { minX, maxX, minY, maxY };
}

/**
 * Detect and validate all series in an array of tiles
 * @param {Array} tiles - Array of detected tiles
 * @param {Object} options - Options for detection
 * @param {number} [options.threshold] - Optional proximity threshold (px)
 *   - If not provided: auto-calculated based on tile density
 *   - If provided: used as exact value (expert override)
 *   - Typical values: 60-120px depending on layout density
 * @param {number} [options.imageWidth] - Image width in pixels (for auto-calculate)
 * @param {number} [options.imageHeight] - Image height in pixels (for auto-calculate)
 * @returns {Array} Array of series objects
 */
function detectSeries(tiles, options = {}) {
    const { threshold = null, imageWidth = null, imageHeight = null } = options;

    if (!tiles || tiles.length === 0) {
        return [];
    }

    // Group tiles by spatial proximity
    const groups = groupTilesBySpatialProximity(tiles, threshold, imageWidth, imageHeight);

    console.log(`📊 Spatial Grouping: ${groups.length} groups detected (threshold: ${threshold || 'auto'}px)`);

    // Analyze each group
    const series = [];
    let seriesId = 0;

    for (const group of groups) {
        // Skip single tiles
        if (group.length < 3) continue;

        // Try to validate as run
        const isRun = isValidRun(group);

        // Try to validate as set
        const isSet = isValidSet(group);

        // Debug logging for groups that fail validation
        if (!isRun && !isSet && group.length >= 3) {
            console.log('⚠️  Series validation failed:', {
                tiles: group.map(t => `${t.color}_${t.number}`),
                groupSize: group.length,
                colors: [...new Set(group.map(t => t.color))],
                numbers: [...new Set(group.map(t => t.number))]
            });
        }

        if (isRun || isSet) {
            // Sort tiles for consistent ordering
            const sortedTiles = [...group].sort((a, b) => {
                if (isRun) {
                    // For runs, Jokers should be positioned by their gap location
                    // For now, put Jokers after regular tiles in sorted order
                    const aNum = a.number === 'Joker' || a.number === 'joker' ? Infinity : parseInt(a.number);
                    const bNum = b.number === 'Joker' || b.number === 'joker' ? Infinity : parseInt(b.number);
                    return aNum - bNum;
                } else {
                    // For sets, Jokers go at the end
                    const aIsJoker = a.number === 'Joker' || a.number === 'joker';
                    const bIsJoker = b.number === 'Joker' || b.number === 'joker';
                    if (aIsJoker && !bIsJoker) return 1;
                    if (!aIsJoker && bIsJoker) return -1;
                    return a.color.localeCompare(b.color);
                }
            });

            const seriesObj = {
                id: seriesId++,
                type: isRun ? 'run' : 'set',
                isValid: true,
                tiles: sortedTiles.map(t => t.id),
                boundingBox: calculateBoundingBox(sortedTiles)
            };

            if (isRun) {
                // For runs, need to extract color from regular tiles (Jokers may have any color)
                const regularTile = sortedTiles.find(t => t.number !== 'Joker' && t.number !== 'joker');
                seriesObj.color = regularTile ? regularTile.color : sortedTiles[0].color;

                // Extract numbers, calculating Joker positions
                const regularNumbers = sortedTiles
                    .filter(t => t.number !== 'Joker' && t.number !== 'joker')
                    .map(t => parseInt(t.number))
                    .sort((a, b) => a - b);

                // Build complete sequence including Joker positions
                const fullSequence = [];
                if (regularNumbers.length > 0) {
                    const minNum = regularNumbers[0];
                    const maxNum = regularNumbers[regularNumbers.length - 1];
                    for (let i = minNum; i <= maxNum; i++) {
                        fullSequence.push(i);
                    }
                }
                seriesObj.numbers = fullSequence;
            } else {
                seriesObj.number = sortedTiles[0].number;
                seriesObj.colors = sortedTiles.map(t => t.color);
            }

            series.push(seriesObj);
        }
    }

    console.log(`✓ Valid series: ${series.length}, ✗ Invalid groups: ${groups.length - series.length}`);

    return series;
}

/**
 * Add series IDs to tiles based on detected series
 */
function assignSeriesToTiles(tiles, series) {
    const tilesWithSeries = tiles.map(tile => ({
        ...tile,
        seriesId: null
    }));

    for (const s of series) {
        for (const tileId of s.tiles) {
            const tile = tilesWithSeries.find(t => t.id === tileId);
            if (tile) {
                tile.seriesId = s.id;
            }
        }
    }

    return tilesWithSeries;
}

module.exports = {
    calculateDistance,
    calculateOptimalThreshold,
    groupTilesBySpatialProximity,
    isValidRun,
    isValidSet,
    calculateBoundingBox,
    detectSeries,
    assignSeriesToTiles
};
