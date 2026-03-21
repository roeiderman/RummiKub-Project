/**
 * Training Data Collection Service
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const CorrectionCounter = require('../models/CorrectionCounter');

const RETRAIN_THRESHOLD = 100;
const DATASET_IMAGES_DIR = path.join(__dirname, '..', '..', 'model', 'dataset', 'images', 'train');
const DATASET_LABELS_DIR = path.join(__dirname, '..', '..', 'model', 'dataset', 'labels', 'train');
const TEMP_IMAGES_DIR = path.join(__dirname, '..', 'public', 'training_images');
const PYTHON_EXECUTABLE = process.env.PYTHON_PATH || 'python';

// // Ensure directories exist
// [DATASET_IMAGES_DIR, DATASET_LABELS_DIR].forEach(dir => {
//     if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
// });

// Class ID mapping from data.yaml (54 classes)
// Stored tile color "Orange" maps back to "Yellow" for the label lookup
const CLASS_MAP = {};
const COLORS = ['Black', 'Blue', 'Red', 'Yellow'];
COLORS.forEach((color, ci) => {
    for (let n = 1; n <= 13; n++) {
        CLASS_MAP[`${color}_${n}`] = ci * 13 + (n - 1);
    }
});
CLASS_MAP['Red_Joker'] = 52;
CLASS_MAP['Black_Joker'] = 53;

function getClassId(tile) {
    if (tile.isJoker || tile.tile === 'Joker') {
        const color = tile.color === 'Orange' ? 'Red' : tile.color; // default joker color
        return CLASS_MAP[`${color}_Joker`] ?? null;
    }
    const color = tile.color === 'Orange' ? 'Yellow' : tile.color;
    const key = `${color}_${tile.number}`;
    return CLASS_MAP[key] ?? null;
}

function tilesToYoloOBB(tiles, imageWidth, imageHeight) {
    const lines = [];
    for (const tile of tiles) {
        if (!tile.corners || tile.corners.length !== 4) continue;
        const classId = getClassId(tile);
        if (classId === null) {
            console.warn(`[Training] Unknown class for tile: ${JSON.stringify(tile)}`);
            continue;
        }
        const coords = tile.corners
            .flatMap(c => [
                (c.x / imageWidth).toFixed(6),
                (c.y / imageHeight).toFixed(6),
            ])
            .join(' ');
        lines.push(`${classId} ${coords}`);
    }
    return lines.join('\n');
}

function triggerRetraining() {
    console.log('\n=======================================');
    console.log('🤖 TRIGGERING AUTOMATED MODEL RETRAINING');
    console.log('=======================================\n');

    const pythonScript = path.join(__dirname, '..', '..', 'model', 'continue_training.py');
    const modelDir = path.join(__dirname, '..', '..', 'model'); // Run from root where data.yaml is

    const pythonProcess = spawn(PYTHON_EXECUTABLE, [pythonScript], { cwd: modelDir });

    pythonProcess.stdout.on('data', (data) => {
        console.log(`[YOLO]: ${data.toString().trim()}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`[YOLO ERROR]: ${data.toString().trim()}`);
    });

    pythonProcess.on('close', (code) => {
        if (code === 0) {
            console.log('✅ Retraining completed successfully! New model saved.');
        } else {
            console.error(`❌ Retraining failed with exit code ${code}`);
        }
    });
}

async function recordCorrection({ detectionId, correctedTiles, imageWidth, imageHeight }) {
    const tempImagePath = path.join(TEMP_IMAGES_DIR, `${detectionId}.jpg`);

    if (!fs.existsSync(tempImagePath)) {
        throw new Error(`Training image not found for detectionId: ${detectionId}`);
    }

    const labelContent = tilesToYoloOBB(correctedTiles, imageWidth, imageHeight);

    // Get next file index
    const counter = await CorrectionCounter.findOneAndUpdate(
        {},
        { $inc: { count: 1, fileIndex: 1 } },
        { upsert: true, returnDocument: 'after' }
    );
    const fileName = `corrected_tile_${counter.fileIndex}`;

    const finalImagePath = path.join(DATASET_IMAGES_DIR, `${fileName}.jpg`);
    const finalLabelPath = path.join(DATASET_LABELS_DIR, `${fileName}.txt`);

    // 1. Move the image directly into the YOLO dataset
    fs.renameSync(tempImagePath, finalImagePath);
    
    // 2. Write the label directly into the YOLO dataset
    fs.writeFileSync(finalLabelPath, labelContent);

    console.log(`[Training] Added ${fileName} to local dataset.`);
    console.log(`[Training] Counter: ${counter.count}/${RETRAIN_THRESHOLD}`);

    // 3. Check threshold and trigger training in the background
    if (counter.count >= RETRAIN_THRESHOLD) {
        console.warn(`[Training] *** ${RETRAIN_THRESHOLD} corrections reached! ***`);
        
        // Reset counter
        await CorrectionCounter.updateOne({}, { $set: { count: 0 } });
        
        // Fire and forget the training process so it doesn't block the API response
        triggerRetraining();
        
        return { count: 0, retrainingTriggered: true };
    }

    return { count: counter.count, retrainingTriggered: false };
}

async function getStats() {
    const counter = await CorrectionCounter.findOne({});
    const count = counter?.count ?? 0;
    return {
        corrections: count,
        remaining: Math.max(0, RETRAIN_THRESHOLD - count),
        readyForRetraining: count >= RETRAIN_THRESHOLD,
    };
}

function deleteTrainingImage(detectionId) {
    const imagePath = path.join(TEMP_IMAGES_DIR, `${detectionId}.jpg`);
    if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log(`[Training] Deleted local image: ${detectionId}.jpg`);
    }
}

function cleanupAbandonedImages(maxAgeMs = 2 * 60 * 60 * 1000) { // default 2 hours
    if (!fs.existsSync(TEMP_IMAGES_DIR)) return;

    const now = Date.now();
    const files = fs.readdirSync(TEMP_IMAGES_DIR).filter(f => f.endsWith('.jpg'));
    let deleted = 0;

    for (const file of files) {
        const filePath = path.join(TEMP_IMAGES_DIR, file);
        const { mtimeMs } = fs.statSync(filePath);
        if (now - mtimeMs > maxAgeMs) {
            fs.unlinkSync(filePath);
            deleted++;
        }
    }

    if (deleted > 0) {
        console.log(`[Training] Cleaned up ${deleted} abandoned image(s) older than ${maxAgeMs / 3600000}h`);
    }
}

module.exports = { recordCorrection, getStats, deleteTrainingImage, cleanupAbandonedImages };
