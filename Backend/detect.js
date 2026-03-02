/**
 * Rummikub Tile Detection - Node.js Backend
 * Receives an image and applies the YOLOv8 model to detect tiles.
 *
 * Usage:
 *   const { detectTiles } = require('./detect');
 *   detectTiles('path/to/image.jpg').then(result => console.log(result));
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Apply the Rummikub detection model to an image.
 *
 * @param {string|Buffer} image - Path to image file or Buffer containing image data
 * @param {Object} options - Optional settings
 * @param {boolean} options.annotate - Also create annotated image (default: false)
 * @returns {Promise<Object>} Detection results as JSON (with optional annotatedImagePath)
 */
async function detectTiles(image, options = {}) {
    const { annotate = false } = options;
    return new Promise((resolve, reject) => {
        // Determine if input is file path or buffer
        let inputPath;
        let tempImageFile = false;

        if (Buffer.isBuffer(image)) {
            // If buffer, save to temp file
            inputPath = path.join(__dirname, 'temp_image.jpg');
            fs.writeFileSync(inputPath, image);
            tempImageFile = true;
        } else if (typeof image === 'string') {
            // If string, assume it's a file path
            inputPath = image;

            // Check if file exists
            if (!fs.existsSync(inputPath)) {
                return reject(new Error(`Image file not found: ${inputPath}`));
            }
        } else {
            return reject(new Error('Invalid input: must be file path (string) or Buffer'));
        }

        console.log(`Applying model to: ${inputPath}`);

        // Create temp JSON output file
        const jsonOutputPath = path.join(__dirname, 'temp_detections.json');

        // Get absolute path for image (use_model.py needs to work from model/ directory)
        const absoluteImagePath = path.resolve(inputPath);

        // Spawn Python process with --json flag to output results
        // Set cwd to model/ directory so relative paths in use_model.py work correctly
        const modelDir = path.join(__dirname, '..', 'model');
        const python = spawn('python3', [
            'use_model.py',
            absoluteImagePath,
            '--json',
            jsonOutputPath
        ], {
            cwd: modelDir  // Run from model/ directory
        });

        let errorData = '';

        // Collect stderr data
        python.stderr.on('data', (data) => {
            errorData += data.toString();
        });

        // Handle process completion
        python.on('close', (code) => {
            // Clean up temp image file if created
            if (tempImageFile && fs.existsSync(inputPath)) {
                fs.unlinkSync(inputPath);
            }

            if (code !== 0) {
                console.error('Python process error:', errorData);
                // Clean up temp JSON file
                if (fs.existsSync(jsonOutputPath)) {
                    fs.unlinkSync(jsonOutputPath);
                }
                return reject(new Error(`Model inference failed: ${errorData}`));
            }

            try {
                // Read JSON output file
                if (!fs.existsSync(jsonOutputPath)) {
                    return reject(new Error('Model did not produce JSON output'));
                }

                const jsonData = fs.readFileSync(jsonOutputPath, 'utf8');
                const result = JSON.parse(jsonData);

                // Clean up temp JSON file
                fs.unlinkSync(jsonOutputPath);

                console.log(`Detected ${result.tiles.length} tiles`);

                // Normalize result format to match expected structure
                const normalizedResult = {
                    success: true,
                    image: result.image,
                    image_width: result.image_width,
                    image_height: result.image_height,
                    num_tiles_detected: result.tiles.length,
                    tiles: result.tiles
                };

                // If annotate option is enabled, create annotated image
                if (annotate) {
                    saveAnnotatedImage(inputPath)
                        .then(annotatedPath => {
                            normalizedResult.annotatedImagePath = annotatedPath;
                            resolve(normalizedResult);
                        })
                        .catch(err => {
                            console.error('Warning: Failed to create annotated image:', err.message);
                            // Still resolve with detection results even if annotation fails
                            resolve(normalizedResult);
                        });
                } else {
                    resolve(normalizedResult);
                }
            } catch (err) {
                // Clean up temp JSON file on error
                if (fs.existsSync(jsonOutputPath)) {
                    fs.unlinkSync(jsonOutputPath);
                }
                reject(new Error(`Failed to parse model output: ${err.message}`));
            }
        });

        // Handle process errors
        python.on('error', (err) => {
            if (tempImageFile && fs.existsSync(inputPath)) {
                fs.unlinkSync(inputPath);
            }
            if (fs.existsSync(jsonOutputPath)) {
                fs.unlinkSync(jsonOutputPath);
            }
            reject(new Error(`Failed to start Python process: ${err.message}`));
        });
    });
}

/**
 * Save annotated image with bounding boxes drawn on detected tiles.
 *
 * @param {string|Buffer} image - Path to image file or Buffer containing image data
 * @returns {Promise<string>} Path to the saved annotated image
 */
async function saveAnnotatedImage(image) {
    return new Promise((resolve, reject) => {
        // Determine if input is file path or buffer
        let inputPath;
        let tempImageFile = false;

        if (Buffer.isBuffer(image)) {
            // If buffer, save to temp file
            inputPath = path.join(__dirname, 'temp_image_annotate.jpg');
            fs.writeFileSync(inputPath, image);
            tempImageFile = true;
        } else if (typeof image === 'string') {
            // If string, assume it's a file path
            inputPath = image;

            // Check if file exists
            if (!fs.existsSync(inputPath)) {
                return reject(new Error(`Image file not found: ${inputPath}`));
            }
        } else {
            return reject(new Error('Invalid input: must be file path (string) or Buffer'));
        }

        console.log(`Creating annotated image for: ${inputPath}`);

        // Get absolute path for image
        const absoluteImagePath = path.resolve(inputPath);

        // Spawn Python process with --save flag
        const modelDir = path.join(__dirname, '..', 'model');
        const python = spawn('python3', [
            'use_model.py',
            absoluteImagePath,
            '--save'
        ], {
            cwd: modelDir
        });

        let errorData = '';

        // Collect stderr data
        python.stderr.on('data', (data) => {
            errorData += data.toString();
        });

        // Handle process completion
        python.on('close', (code) => {
            // Clean up temp image file if created
            if (tempImageFile && fs.existsSync(inputPath)) {
                fs.unlinkSync(inputPath);
            }

            if (code !== 0) {
                console.error('Python process error:', errorData);
                return reject(new Error(`Annotation failed: ${errorData}`));
            }

            try {
                // Find the annotated image in predict folder
                const predictDir = path.join(modelDir, 'predict');
                if (!fs.existsSync(predictDir)) {
                    return reject(new Error('Predict directory not found'));
                }

                // Find the most recent predict folder
                const folders = fs.readdirSync(predictDir)
                    .filter(f => f.startsWith('predict'))
                    .map(f => ({
                        name: f,
                        path: path.join(predictDir, f),
                        time: fs.statSync(path.join(predictDir, f)).mtime.getTime()
                    }))
                    .sort((a, b) => b.time - a.time);

                if (folders.length === 0) {
                    return reject(new Error('No predict folder found'));
                }

                const imageName = path.basename(absoluteImagePath);
                const annotatedImagePath = path.join(folders[0].path, imageName);

                if (!fs.existsSync(annotatedImagePath)) {
                    return reject(new Error(`Annotated image not found: ${annotatedImagePath}`));
                }

                console.log(`Annotated image saved to: ${annotatedImagePath}`);
                resolve(annotatedImagePath);
            } catch (err) {
                reject(new Error(`Failed to find annotated image: ${err.message}`));
            }
        });

        // Handle process errors
        python.on('error', (err) => {
            if (tempImageFile && fs.existsSync(inputPath)) {
                fs.unlinkSync(inputPath);
            }
            reject(new Error(`Failed to start Python process: ${err.message}`));
        });
    });
}

/**
 * Pretty print detection results
 *
 * @param {Object} result - Detection result from detectTiles()
 */
function printResults(result) {
    console.log('\n' + '='.repeat(60));
    console.log('DETECTED TILES');
    console.log('='.repeat(60));
    console.log(`Image size: ${result.image_width}x${result.image_height}`);
    console.log(`Tiles detected: ${result.num_tiles_detected}\n`);

    if (result.tiles && result.tiles.length > 0) {
        // Count tiles by type
        const tileCounts = {};
        result.tiles.forEach(tile => {
            tileCounts[tile.tile] = (tileCounts[tile.tile] || 0) + 1;
        });

        console.log('Tile Summary:');
        Object.entries(tileCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([tile, count]) => {
                console.log(`  ${tile}: ${count}x`);
            });

        console.log('\nDetailed Results:');
        result.tiles.forEach((tile, i) => {
            console.log(`\n[${i + 1}] ${tile.tile}`);
            console.log(`    Color: ${tile.color}, Number: ${tile.number}`);
            console.log(`    Confidence: ${(tile.confidence * 100).toFixed(1)}%`);
            console.log(`    Position: (${tile.position.x.toFixed(0)}, ${tile.position.y.toFixed(0)})`);
            console.log(`    Rotation: ${tile.rotation_degrees.toFixed(1)}°`);
        });
    } else {
        console.log('No tiles detected in image.');
    }

    console.log('\n' + '='.repeat(60));
}

// Export functions
module.exports = {
    detectTiles,
    saveAnnotatedImage,
    printResults
};

// CLI usage: node detect.js <image_path> [--annotate] [--json]
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('Usage: node detect.js <image_path> [--annotate] [--json]');
        console.error('  --annotate: Create annotated image with bounding boxes');
        console.error('  --json: Save detection results to JSON file');
        process.exit(1);
    }

    const imagePath = args[0];
    const shouldAnnotate = args.includes('--annotate');

    detectTiles(imagePath, { annotate: shouldAnnotate })
        .then(result => {
            printResults(result);

            // Show annotated image path if created
            if (result.annotatedImagePath) {
                console.log(`\n✓ Annotated image saved to: ${result.annotatedImagePath}`);
                console.log('  (You can delete this file after verification)');
            }

            // Optionally save to JSON file
            if (args.includes('--json')) {
                const outputPath = imagePath.replace(/\.[^.]+$/, '_detections.json');
                fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
                console.log(`\n✓ JSON saved to: ${outputPath}`);
            }
        })
        .catch(err => {
            console.error('Error:', err.message);
            process.exit(1);
        });
}
