 /**
 * Rummikub Tile Detection - Node.js Backend
 * Receives an image and applies the YOLOv8 model to detect tiles.
 */

require('dotenv').config(); // <--- ADDED: Load environment variables
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Get Python path from .env or default to 'python'
const PYTHON_EXECUTABLE = process.env.PYTHON_PATH || 'python';
const SCRIPT_NAME = 'use_model.py'; // Name of your python script

// Shared promise — concurrent rack+board calls share one HF check per button press
let modelCheckPromise = null;


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
    await checkModelVersion();
    return new Promise((resolve, reject) => {
        let inputPath;
        let tempImageFile = false;

        // CREATE A UNIQUE ID FOR THIS SPECIFIC REQUEST
        const detectionId = crypto.randomUUID();

        // 1. PREPARE IMAGE
        if (Buffer.isBuffer(image)) {
            inputPath = path.join(__dirname, `temp_image_${detectionId}.jpg`);
            fs.writeFileSync(inputPath, image);
            tempImageFile = true;
        } else if (typeof image === 'string') {
            inputPath = image;
            if (!fs.existsSync(inputPath)) {
                return reject(new Error(`Image file not found: ${inputPath}`));
            }
        } else {
            return reject(new Error('Invalid input: must be file path (string) or Buffer'));
        }

        console.log(`Applying model to: ${inputPath}`);

        const jsonOutputPath = path.join(__dirname, `temp_detections_${detectionId}.json`);
        const absoluteImagePath = path.resolve(inputPath);
        const modelDir = path.join(__dirname, '..', '..', 'model');
        
        // 2. RUN PYTHON DETECTION (+ annotation in the same call if requested)
        const spawnArgs = [SCRIPT_NAME, absoluteImagePath, '--json', jsonOutputPath];
        if (annotate) spawnArgs.push('--save');
        const python = spawn(PYTHON_EXECUTABLE, spawnArgs, { cwd: modelDir });

        let errorData = '';
        python.stdout.on('data', (data) => process.stdout.write(data));
        python.stderr.on('data', (data) => errorData += data.toString());

        python.on('close', (code) => {
            // Note: We do NOT delete the temp file here anymore!

            if (code !== 0) {
                console.error('Python process error:', errorData);
                if (fs.existsSync(jsonOutputPath)) fs.unlinkSync(jsonOutputPath);
                
                // Cleanup on error
                if (tempImageFile && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                
                return reject(new Error(`Model inference failed: ${errorData}`));
            }

            try {
                if (!fs.existsSync(jsonOutputPath)) {
                    if (tempImageFile && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                    return reject(new Error('Model did not produce JSON output'));
                }

                const jsonData = fs.readFileSync(jsonOutputPath, 'utf8');
                const result = JSON.parse(jsonData);
                fs.unlinkSync(jsonOutputPath); // Delete JSON temp file

                console.log(`Detected ${result.tiles.length} tiles`);

                // Normalize tile colors (Yellow -> Orange for Rummikub standard colors)
                const normalizedTiles = result.tiles.map(tile => ({
                    ...tile,
                    color: tile.color === 'Yellow' ? 'Orange' : tile.color,
                    number: parseInt(tile.number, 10), // Ensure number is a string for consistency
                    isJoker: tile.tile.toLowerCase().includes('joker') // Add isJoker flag based on tile name
                }));

                // Save image for training data collection
                const trainingImagesDir = path.join(__dirname, '..', 'public', 'training_images');
                fs.mkdirSync(trainingImagesDir, { recursive: true });
                const savedImagePath = path.join(trainingImagesDir, `${detectionId}.jpg`);
                if (tempImageFile && fs.existsSync(inputPath)) {
                    fs.renameSync(inputPath, savedImagePath);
                    tempImageFile = false; // file is now at savedImagePath, not inputPath
                }

                const normalizedResult = {
                    success: true,
                    image: result.image,
                    image_width: result.image_width,
                    image_height: result.image_height,
                    num_tiles_detected: normalizedTiles.length,
                    tiles: normalizedTiles,
                    detectionId
                };

                // 3. FIND ANNOTATED IMAGE (already saved by the single Python call above)
                if (annotate) {
                    try {
                        const predictDir = path.join(modelDir, 'predict');
                        if (fs.existsSync(predictDir)) {
                            const folders = fs.readdirSync(predictDir)
                                .filter(f => f.startsWith('predict'))
                                .map(f => ({ path: path.join(predictDir, f), time: fs.statSync(path.join(predictDir, f)).mtime.getTime() }))
                                .sort((a, b) => b.time - a.time);
                            if (folders.length > 0) {
                                const candidate = path.join(folders[0].path, path.basename(absoluteImagePath));
                                if (fs.existsSync(candidate)) {
                                    normalizedResult.annotatedImagePath = candidate;
                                }
                            }
                        }
                    } catch (err) {
                        console.error('Warning: Failed to find annotated image:', err.message);
                    }
                }
                resolve(normalizedResult);
            } catch (err) {
                if (fs.existsSync(jsonOutputPath)) fs.unlinkSync(jsonOutputPath);
                if (tempImageFile && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                reject(new Error(`Failed to parse model output: ${err.message}`));
            }
        });

        python.on('error', (err) => {
            if (tempImageFile && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(jsonOutputPath)) fs.unlinkSync(jsonOutputPath);
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
            const uniqueId = crypto.randomBytes(8).toString('hex');
            inputPath = path.join(__dirname, `temp_image_annotate_${uniqueId}.jpg`);
            fs.writeFileSync(inputPath, image);
            tempImageFile = true;
        } else if (typeof image === 'string') {
            inputPath = image;
            if (!fs.existsSync(inputPath)) {
                return reject(new Error(`Image file not found: ${inputPath}`));
            }
        } else {
            return reject(new Error('Invalid input: must be file path (string) or Buffer'));
        }

        console.log(`Creating annotated image for: ${inputPath}`);

        const absoluteImagePath = path.resolve(inputPath);
        const modelDir = path.join(__dirname, '..', '..', 'model');
        
        const python = spawn(PYTHON_EXECUTABLE, [
            SCRIPT_NAME, absoluteImagePath, '--save'
        ], { cwd: modelDir });

        let errorData = '';
        python.stdout.on('data', (data) => process.stdout.write(data));
        python.stderr.on('data', (data) => {
            errorData += data.toString();
        });

        python.on('close', (code) => {
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
                // YOLO sometimes saves as .jpg even if input is .png, check both
                let annotatedImagePath = path.join(folders[0].path, imageName);
                
                if (!fs.existsSync(annotatedImagePath)) {
                     return reject(new Error(`Annotated image not found: ${annotatedImagePath}`));
                }

                resolve(annotatedImagePath);
            } catch (err) {
                reject(new Error(`Failed to find annotated image: ${err.message}`));
            }
        });

        python.on('error', (err) => {
            if (tempImageFile && fs.existsSync(inputPath)) {
                fs.unlinkSync(inputPath);
            }
            reject(new Error(`Failed to start Python process: ${err.message}`));
        });
    });
}

function printResults(result) {
    console.log('\n' + '='.repeat(60));
    console.log('DETECTED TILES');
    console.log('='.repeat(60));
    console.log(`Image size: ${result.image_width}x${result.image_height}`);
    console.log(`Tiles detected: ${result.num_tiles_detected}\n`);

    if (result.tiles && result.tiles.length > 0) {
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

/**
 * Check HuggingFace for a newer model version before each detection.
 * Concurrent calls (rack + board) share one check via modelCheckPromise.
 * After it resolves, the next button press creates a fresh check.
 */
async function checkModelVersion() {
    if (modelCheckPromise) return modelCheckPromise;

    modelCheckPromise = (async () => {
    const hfRepo = process.env.HF_MODEL_REPO || 'roeiderman/Rummikub';
    const hfToken = process.env.HF_TOKEN;
        const modelPath = path.join(__dirname, '..', '..', 'model', 'models', 'rummikub_best.pt');

    try {
        const response = await fetch(`https://huggingface.co/api/models/${hfRepo}`, {
            headers: { 'Authorization': `Bearer ${hfToken}` }
        });

        if (!response.ok) {
            console.log(`[Model] Could not reach HuggingFace (${response.status}) — using local model.`);
            return;
        }

        const data = await response.json();
        const hfLastModified = new Date(data.lastModified).getTime();

        if (!fs.existsSync(modelPath)) {
            console.log('[Model] Not found locally — will download on first detection.');
        } else {
            const localMtime = fs.statSync(modelPath).mtimeMs;
            if (hfLastModified > localMtime) {
                console.log('[Model] HuggingFace has a newer version — removing local copy. Will re-download on first detection.');
                fs.unlinkSync(modelPath);
            } else {
                console.log('[Model] Local model is up to date.');
            }
        }
    } catch (err) {
        console.log(`[Model] Could not check HuggingFace: ${err.message} — using local model.`);
    }
    })();

    await modelCheckPromise;
    modelCheckPromise = null; // clear so next button press triggers a fresh check
}

module.exports = {
    detectTiles,
    saveAnnotatedImage,
    printResults
};

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.error('Usage: node detect.js <image_path> [--annotate] [--json]');
        process.exit(1);
    }

    const imagePath = args[0];
    const shouldAnnotate = args.includes('--annotate');

    detectTiles(imagePath, { annotate: shouldAnnotate })
        .then(result => {
            printResults(result);
            if (result.annotatedImagePath) {
                console.log(`\n✓ Annotated image saved to: ${result.annotatedImagePath}`);
            }
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