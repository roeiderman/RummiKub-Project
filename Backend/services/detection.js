/**
 * Detection Service - Wraps detect.js module
 */

const { detectTiles } = require('../utils/detect');

/**
 * Perform tile detection WITH series analysis
 * @param {Buffer} imageBuffer - Image data
 * @param {Object} options - Detection options
 * @returns {Object} Detection results with series information
 */
const performDetection = async (imageBuffer, options = {}) => {
    const { annotate = false, groupFlag = false} = options;

    try {
        // 1. Perform basic tile detection
        const result = await detectTiles(imageBuffer, { annotate });

        // 2. If series analysis requested, detect series
        if (groupFlag && result.tiles && result.tiles.length > 0) {
            const groups = groupTiles(result.tiles);
            //const tilesWithSeries = gameLogic.assignSeriesToTiles(result.tiles, series);

            groups.forEach(group => {
                if (group.length >= 3) {
                    if (!(group[0].number + 1 == group[1].number ||
                        group[0].number + 2 == group[2].number))
                    {
                        group.reverse()
                    }
                }
            });

            return {
                success: true,
                imageWidth: result.image_width,
                imageHeight: result.image_height,
                numTilesDetected: result.num_tiles_detected,
                groups: groups,
                numSeriesDetected: groups.length,
                detectionId: result.detectionId,
                ...(result.annotatedImagePath && { annotatedImagePath: result.annotatedImagePath })
            };
        }

        // 3. Return basic detection if no group analysis
        return {
            success: true,
            imageWidth: result.image_width,
            imageHeight: result.image_height,
            numTilesDetected: result.num_tiles_detected,
            rack: result.tiles,
            detectionId: result.detectionId,
            ...(result.annotatedImagePath && { annotatedImagePath: result.annotatedImagePath })
        };
    } catch (error) {
        console.error('Detection with analysis error:', error);
        throw error;
    }
};

/**
 * Groups tiles based on physical proximity and visual alignment (rotation invariant).
 */
function groupTiles(tiles) {
    if (!tiles || tiles.length === 0) return [];

    // Helper: Calculates the physical properties of a tile from its corners
    function getTileProperties(tile) {
        const c = tile.corners;
        // Calculate the lengths of two adjacent sides
        const side1 = { dx: c[1].x - c[0].x, dy: c[1].y - c[0].y };
        const side2 = { dx: c[2].x - c[1].x, dy: c[2].y - c[1].y };
        
        const len1 = Math.hypot(side1.dx, side1.dy);
        const len2 = Math.hypot(side2.dx, side2.dy);
        
        // In Rummikub, the width (top/bottom) is shorter than the height (sides)
        const width = Math.min(len1, len2);
        
        // Find the vector that points along the width (how a series grows)
        let dir = len1 < len2 ? side1 : side2;
        let dirX = dir.dx / width;
        let dirY = dir.dy / width;
        
        // Force the vector to always point generally "Rightwards" 
        // This ensures sorting works consistently later
        if (dirX < 0 || (Math.abs(dirX) < 0.01 && dirY < 0)) {
            dirX = -dirX;
            dirY = -dirY;
        }
        
        return { width, dirX, dirY };
    }

    // 1. Build an Adjacency Graph (Who is touching who?)
    const graph = new Map();
    tiles.forEach(t => graph.set(t.id, []));

    for (let i = 0; i < tiles.length; i++) {
        for (let j = i + 1; j < tiles.length; j++) {
            const t1 = tiles[i];
            const t2 = tiles[j];
            
            const prop1 = getTileProperties(t1);
            const prop2 = getTileProperties(t2);
            
            // Calculate distance between tile centers
            const dx = t2.position.x - t1.position.x;
            const dy = t2.position.y - t1.position.y;
            const dist = Math.hypot(dx, dy);
            
            const avgWidth = (prop1.width + prop2.width) / 2;
            
            // RULE 1: Distance Check (Must be within 1.8x tile widths of each other)
            if (dist > avgWidth * 1.8) continue;
            
            // Normalize the vector connecting the two centers
            const vX = dx / dist;
            const vY = dy / dist;
            
            // RULE 2: Alignment Check (Dot Product)
            // Checks if the tile's rotation matches the direction to its neighbor
            const dot1 = Math.abs(vX * prop1.dirX + vY * prop1.dirY);
            const dot2 = Math.abs(vX * prop2.dirX + vY * prop2.dirY);
            
            // 0.82 allows for a messy placement angle of about 35 degrees
            if (dot1 > 0.82 && dot2 > 0.82) {
                // They are legally connected! Add them to each other's lists.
                graph.get(t1.id).push(t2);
                graph.get(t2.id).push(t1);
            }
        }
    }

    // 2. Find Connected Components (Group the graph)
    const visited = new Set();
    const groups = [];

    for (const tile of tiles) {
        if (!visited.has(tile.id)) {
            const group = [];
            const stack = [tile];
            visited.add(tile.id);
            
            // Depth-First Search to find all connected tiles
            while (stack.length > 0) {
                const curr = stack.pop();
                group.push(curr);
                
                const neighbors = graph.get(curr.id);
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor.id)) {
                        visited.add(neighbor.id);
                        stack.push(neighbor);
                    }
                }
            }
            groups.push(group);
        }
    }

    // 3. Sort each group internally (so "5,4,3,2" becomes "2,3,4,5")
    for (const group of groups) {
        if (group.length === 0) continue;
        
        // Grab the alignment axis of the first tile
        const prop = getTileProperties(group[0]);
        
        // Project all tiles onto that axis and sort
        group.sort((a, b) => {
            const projA = a.position.x * prop.dirX + a.position.y * prop.dirY;
            const projB = b.position.x * prop.dirX + b.position.y * prop.dirY;
            return projA - projB;
        });
    }

    return groups;
}


module.exports = {
    performDetection
};
