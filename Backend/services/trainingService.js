/**
 * Training Data Collection Service
 * Converts corrected tile detections to YOLO OBB format and uploads to HuggingFace Dataset.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { uploadFiles } = require('@huggingface/hub');
const CorrectionCounter = require('../models/CorrectionCounter');

const KAGGLE_DIR = path.join(__dirname, '..', '..', 'model');

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
            console.warn(`[Retraining] Unknown class for tile: ${JSON.stringify(tile)}`);
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

// Serialize all HF uploads — prevents concurrent commits causing 412 conflicts
let uploadQueue = Promise.resolve();

async function uploadToHFDataset(fileName, imagePath, labelContent) {
    if (!HF_DATASET_REPO) throw new Error('HF_DATASET_REPO is not set in .env');
    if (!HF_TOKEN) throw new Error('HF_TOKEN is not set in .env');

    const imageBuffer = fs.readFileSync(imagePath);

    // Chain onto the queue so uploads never run simultaneously
    uploadQueue = uploadQueue.then(async () => {
        console.log(`[Retraining] Uploading to HF Dataset (${HF_DATASET_REPO})...`);
        console.log(`[Retraining]   images/${fileName}.jpg`);
        console.log(`[Retraining]   labels/${fileName}.txt (${labelContent.split('\n').length} tiles)`);

        // Retry up to 3 times on 412 commit conflict
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                await uploadFiles({
                    repo: { type: 'dataset', name: HF_DATASET_REPO },
                    credentials: { accessToken: HF_TOKEN },
                    files: [
                        { path: `images/${fileName}.jpg`, content: new Blob([imageBuffer], { type: 'image/jpeg' }) },
                        { path: `labels/${fileName}.txt`, content: new Blob([labelContent], { type: 'text/plain' }) },
                    ],
                    commitTitle: `Add ${fileName}`,
                });
                console.log(`[Retraining] Upload complete.`);
                return;
            } catch (err) {
                if (err.statusCode === 412 && attempt < 3) {
                    const delay = attempt * 1000;
                    console.log(`[Retraining] Commit conflict, retrying in ${delay}ms (attempt ${attempt}/3)...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw err;
                }
            }
        }
    });

    await uploadQueue;
}

// Called when a user corrects a detection. The user only corrects the tile identity (color/number),
// not its position — so we take the original corners from the detection and the corrected class ID
// from the user, normalize the corners to 0-1 range, and build a YOLO OBB label file.
// Uploads the white-background image (or original as fallback) + label to HF dataset,
// then deletes both local image files to save disk space.
// When the correction counter reaches 100, resets it and triggers a Kaggle retraining job.
async function recordCorrection({ detectionId, isRack, correctedTiles, imageWidth, imageHeight }) {
    const type = isRack ? 'rack' : 'board';
    console.log(`[Retraining] Correction received — ${type}, detectionId: ${detectionId}`);
    console.log(`[Retraining] Corrected tiles: ${correctedTiles.length}, image: ${imageWidth}x${imageHeight}`);

    const imagePath      = path.join(TRAINING_IMAGES_DIR, `${detectionId}.jpg`);
    const whiteBgPath    = path.join(TRAINING_IMAGES_DIR, `${detectionId}_white.jpg`);
    const uploadPath     = fs.existsSync(whiteBgPath) ? whiteBgPath : imagePath;

    if (!fs.existsSync(uploadPath)) {
        console.error(`[Retraining] Image not found at: ${uploadPath}`);
        throw new Error(`Training image not found for detectionId: ${detectionId}`);
    }

    console.log(`[Retraining] Using ${fs.existsSync(whiteBgPath) ? 'white-background' : 'original'} image for upload.`);

    // Convert corrected tiles to YOLO OBB format
    const labelContent = tilesToYoloOBB(correctedTiles, imageWidth, imageHeight);
    console.log(`[Retraining] YOLO label generated (${labelContent.split('\n').filter(Boolean).length} lines)`);

    // Get next file index atomically (fileIndex never resets, count resets at threshold)
    const counter = await CorrectionCounter.findOneAndUpdate(
        {},
        { $inc: { count: 1, fileIndex: 1 } },
        { upsert: true, returnDocument: 'after' }
    );
    const fileName = `tile${counter.fileIndex}`;

    // Upload white-background image (or original as fallback) + label to HF Dataset
    await uploadToHFDataset(fileName, uploadPath, labelContent);

    // Delete both local files after successful upload
    if (fs.existsSync(whiteBgPath)) fs.unlinkSync(whiteBgPath);
    if (fs.existsSync(imagePath))   fs.unlinkSync(imagePath);
    console.log(`[Retraining] Local images deleted. Saved as ${fileName} on HF.`);
    console.log(`[Retraining] Counter: ${counter.count}/${RETRAIN_THRESHOLD}`);

    if (counter.count >= RETRAIN_THRESHOLD) {
        console.warn(`[Retraining] *** ${RETRAIN_THRESHOLD} corrections reached — triggering Kaggle retraining ***`);
        await CorrectionCounter.updateOne({}, { $set: { count: 0 } });
        triggerKaggleTraining();
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

const KAGGLE_CLI         = process.env.KAGGLE_CLI || 'kaggle';
const KAGGLE_KERNEL_ID   = 'roeiderman1/rummikub-retrain-model';
const KAGGLE_POLL_MS     = 2 * 60 * 1000; // poll every 2 minutes

function pollKaggleStatus() {
    console.log(`[Kaggle] Polling status every ${KAGGLE_POLL_MS / 60000} min...`);

    const poll = setInterval(() => {
        exec(`"${KAGGLE_CLI}" kernels status ${KAGGLE_KERNEL_ID}`, (error, stdout) => {
            if (error) {
                console.error('[Kaggle] Could not fetch status:', error.message);
                clearInterval(poll);
                return;
            }

            // Status row is the last non-empty line of the table output
            const lines = stdout.trim().split('\n').filter(Boolean);
            const statusLine = lines[lines.length - 1];
            console.log(`[Kaggle] ${statusLine}`);

            const lower = statusLine.toLowerCase();
            if (lower.includes('complete')) {
                console.log('[Kaggle] Job completed successfully! Check HuggingFace for updated model.');
                clearInterval(poll);
            } else if (lower.includes('error')) {
                console.error('[Kaggle] Job failed. Visit kaggle.com for full logs.');
                clearInterval(poll);
            } else if (lower.includes('cancel')) {
                console.warn('[Kaggle] Job was cancelled.');
                clearInterval(poll);
            }
        });
    }, KAGGLE_POLL_MS);
}

function ensureKaggleCredentials() {
    const kaggleDir = path.join(os.homedir(), '.kaggle');
    const kaggleConfig = path.join(kaggleDir, 'kaggle.json');
    if (!fs.existsSync(kaggleConfig)) {
        fs.mkdirSync(kaggleDir, { recursive: true });
        fs.writeFileSync(
            kaggleConfig,
            JSON.stringify({ username: process.env.KAGGLE_USERNAME, key: process.env.KAGGLE_KEY }),
            { mode: 0o600 }
        );
        console.log('[Kaggle] Created ~/.kaggle/kaggle.json from env vars.');
    }
}

// Pushes a new version of the retraining script to Kaggle and triggers a run.
// HF_TOKEN is injected directly into a temp copy of the script because Kaggle CLI
// resets secret attachments on every push. Temp dir is deleted after push completes.
// The push runs as a non-blocking child process — Node.js continues handling requests
// while it runs. When it finishes, the callback cleans up the temp dir and starts
// polling Kaggle every 2 minutes until the job finishes.
function triggerKaggleTraining() {
    ensureKaggleCredentials();

    const hfToken = process.env.HF_TOKEN;
    if (!hfToken) {
        console.error('[Kaggle] HF_TOKEN not set in .env — cannot push retraining job');
        return;
    }

    // Kaggle's CLI push resets secret attachments on every new version, so we inject
    // the token into a temporary copy of the script before pushing. The temp directory
    // is deleted immediately after. The kernel is private, so only the owner can see it.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaggle-push-'));
    try {
        const script = fs.readFileSync(path.join(KAGGLE_DIR, 'retrain_model_in_kaggle.py'), 'utf8');
        const injected = script.replace(
            'secrets = UserSecretsClient()\nhf_token = secrets.get_secret("HF_TOKEN")',
            `hf_token = "${hfToken}"`
        );
        fs.writeFileSync(path.join(tmpDir, 'retrain_model_in_kaggle.py'), injected, 'utf8');
        fs.copyFileSync(
            path.join(KAGGLE_DIR, 'kernel-metadata.json'),
            path.join(tmpDir, 'kernel-metadata.json')
        );
    } catch (err) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        console.error('[Kaggle] Failed to prepare push directory:', err.message);
        return;
    }

    console.log('[Kaggle] Pushing retraining job...');
    const env = { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' };

    exec(`"${KAGGLE_CLI}" kernels push -p "${tmpDir}"`, { env, encoding: 'utf8' }, (error, stdout, stderr) => {
        fs.rmSync(tmpDir, { recursive: true, force: true });

        const realStderr = stderr.replace(/.*NotOpenSSLWarning.*\n?/g, '').trim();
        if (stdout) console.log('[Kaggle]', stdout.trim());
        if (realStderr) console.error('[Kaggle] stderr:', realStderr);
        if (error) {
            console.error('[Kaggle] Failed to push job. Exit code:', error.code);
        } else {
            console.log('[Kaggle] Job pushed successfully. Starting status polling...');
            setTimeout(pollKaggleStatus, 30 * 1000);
        }
    });
}

function deleteTrainingImage(detectionId) {
    const imagePath   = path.join(TRAINING_IMAGES_DIR, `${detectionId}.jpg`);
    const whiteBgPath = path.join(TRAINING_IMAGES_DIR, `${detectionId}_white.jpg`);
    if (fs.existsSync(imagePath))   { fs.unlinkSync(imagePath);   console.log(`[Retraining] Deleted local image: ${detectionId}.jpg`); }
    if (fs.existsSync(whiteBgPath)) { fs.unlinkSync(whiteBgPath); console.log(`[Retraining] Deleted local image: ${detectionId}_white.jpg`); }
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
        console.log(`[Retraining] Cleaned up ${deleted} abandoned image(s) older than ${maxAgeMs / 3600000}h`);
    }
}

module.exports = { recordCorrection, getStats, deleteTrainingImage, cleanupAbandonedImages };
