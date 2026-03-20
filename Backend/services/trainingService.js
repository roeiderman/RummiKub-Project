/**
 * Training Data Collection Service
 * Converts corrected tile detections to YOLO OBB format and uploads to HuggingFace Dataset.
 */

const fs = require('fs');
const path = require('path');
const { uploadFiles } = require('@huggingface/hub');
const CorrectionCounter = require('../models/CorrectionCounter');

const HF_DATASET_REPO = process.env.HF_DATASET_REPO;
const HF_TOKEN = process.env.HF_TOKEN;
const RETRAIN_THRESHOLD = 100;
const TRAINING_IMAGES_DIR = path.join(__dirname, '..', 'public', 'training_images');

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

async function uploadToHFDataset(fileName, imagePath, labelContent) {
    if (!HF_DATASET_REPO) throw new Error('HF_DATASET_REPO is not set in .env');
    if (!HF_TOKEN) throw new Error('HF_TOKEN is not set in .env');

    console.log(`[Training] Uploading to HF Dataset (${HF_DATASET_REPO})...`);
    console.log(`[Training]   images/${fileName}.jpg`);
    console.log(`[Training]   labels/${fileName}.txt (${labelContent.split('\n').length} tiles)`);

    const imageBuffer = fs.readFileSync(imagePath);

    await uploadFiles({
        repo: { type: 'dataset', name: HF_DATASET_REPO },
        credentials: { accessToken: HF_TOKEN },
        files: [
            {
                path: `images/${fileName}.jpg`,
                content: new Blob([imageBuffer], { type: 'image/jpeg' }),
            },
            {
                path: `labels/${fileName}.txt`,
                content: new Blob([labelContent], { type: 'text/plain' }),
            },
        ],
        commitTitle: `Add ${fileName}`,
    });

    console.log(`[Training] Upload complete.`);
}

async function recordCorrection({ detectionId, isRack, correctedTiles, imageWidth, imageHeight }) {
    const type = isRack ? 'rack' : 'board';
    console.log(`[Training] Correction received — ${type}, detectionId: ${detectionId}`);
    console.log(`[Training] Corrected tiles: ${correctedTiles.length}, image: ${imageWidth}x${imageHeight}`);

    const imagePath = path.join(TRAINING_IMAGES_DIR, `${detectionId}.jpg`);

    if (!fs.existsSync(imagePath)) {
        console.error(`[Training] Image not found at: ${imagePath}`);
        throw new Error(`Training image not found for detectionId: ${detectionId}`);
    }

    // Convert corrected tiles to YOLO OBB format
    const labelContent = tilesToYoloOBB(correctedTiles, imageWidth, imageHeight);
    console.log(`[Training] YOLO label generated (${labelContent.split('\n').filter(Boolean).length} lines)`);

    // Get next file index atomically (fileIndex never resets, count resets at threshold)
    const counter = await CorrectionCounter.findOneAndUpdate(
        {},
        { $inc: { count: 1, fileIndex: 1 } },
        { upsert: true, returnDocument: 'after' }
    );
    const fileName = `tile${counter.fileIndex}`;

    // Upload image + label to HF Dataset
    await uploadToHFDataset(fileName, imagePath, labelContent);

    // Delete local image after successful upload
    fs.unlinkSync(imagePath);
    console.log(`[Training] Local image deleted. Saved as ${fileName} on HF.`);
    console.log(`[Training] Counter: ${counter.count}/${RETRAIN_THRESHOLD}`);

    if (counter.count >= RETRAIN_THRESHOLD) {
        console.warn(`[Training] *** ${RETRAIN_THRESHOLD} corrections reached — dataset ready for retraining ***`);
        await CorrectionCounter.updateOne({}, { $set: { count: 0 } });
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
    const imagePath = path.join(TRAINING_IMAGES_DIR, `${detectionId}.jpg`);
    if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log(`[Training] Deleted local image: ${detectionId}.jpg`);
    }
}

function cleanupAbandonedImages(maxAgeMs = 2 * 60 * 60 * 1000) { // default 2 hours
    if (!fs.existsSync(TRAINING_IMAGES_DIR)) return;

    const now = Date.now();
    const files = fs.readdirSync(TRAINING_IMAGES_DIR).filter(f => f.endsWith('.jpg'));
    let deleted = 0;

    for (const file of files) {
        const filePath = path.join(TRAINING_IMAGES_DIR, file);
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
