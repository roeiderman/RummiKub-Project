/**
 * Training Challenges — Scenario Service
 *
 * HF layout (root of HF_SCENARIOS_REPO dataset):
 *   index.json           — array of metadata objects
 *   scenario_{id}.json   — full scenario data
 *
 * Cache is loaded lazily on first request — zero startup cost.
 */

const crypto = require('crypto');
const { uploadFiles } = require('@huggingface/hub');
const { isValidRun, isValidSet } = require('../utils/gameLogic');
const ScenarioLeaderboard = require('../models/ScenarioLeaderboard');
const User = require('../models/User');

const HF_SCENARIOS_REPO = process.env.HF_SCENARIOS_REPO;
const HF_TOKEN = process.env.HF_TOKEN;

// In-memory store: Map<id, fullScenario>
const scenarioCache = new Map();

// Lazy-load state
let cacheLoaded = false;
let loadingPromise = null;

// Serialize all HF uploads to prevent 412 commit conflicts
let uploadQueue = Promise.resolve();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hfRawUrl(filePath) {
    return `https://huggingface.co/datasets/${HF_SCENARIOS_REPO}/resolve/main/${filePath}`;
}

async function fetchFromHF(filePath, timeoutMs = 20000) {
    const res = await fetch(hfRawUrl(filePath), {
        headers: { Authorization: `Bearer ${HF_TOKEN}` },
        signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HF fetch failed (${res.status}) for ${filePath}`);
    return res.json();
}

function normalizeTile(t) {
    const color = t.color || '';
    const number = String(t.number ?? '');
    const isJoker = t.isJoker ? '1' : '0';
    return `${color}|${number}|${isJoker}`;
}

/**
 * Difficulty is a weighted composite of four signals:
 *
 *  1. Tiles removed (×3, dominant) — the more rack tiles the AI placed, the harder
 *     the puzzle is: more tiles means a more complex solution path.
 *
 *  2. Rack utilization (×5) — placing 9 out of 10 tiles (90%) is harder than
 *     placing 9 out of 14 (64%), because the solution space is much more constrained.
 *
 *  3. Board complexity (+0.5 per group, +0.2 per avg tile in group) — more groups
 *     on the board mean more rearrangement options to evaluate, which makes finding
 *     the right move harder.
 *
 *  4. Jokers in rack (−1.5 each) — a joker can substitute for any tile, so having
 *     one makes forming valid groups much easier and lowers difficulty.
 *
 * Thresholds (score < 22 → easy, < 32 → medium, else → hard) were chosen to
 * produce a rough equal split across realistic game states. Tune if real data
 * shows all scenarios clustering in one tier.
 */
function computeDifficulty(rack, board, algorithmTilesRemoved) {
    const jokerCountRack = rack.filter(t => t.isJoker).length;
    const boardGroupCount = board.length;
    const boardTileCount  = board.flat().length;
    const utilization     = algorithmTilesRemoved / Math.max(rack.length, 1);

    const score =
        algorithmTilesRemoved * 3
        + utilization * 5
        + boardGroupCount * 0.5
        + (boardTileCount / Math.max(boardGroupCount, 1)) * 0.2
        - jokerCountRack * 1.5;

    if (score < 22) return 'easy';
    if (score < 32) return 'medium';
    return 'hard';
}

function computeContentHash(rack, board) {
    const rackSig = rack.map(normalizeTile).sort().join(',');
    const boardSig = board
        .map(group => group.map(normalizeTile).sort().join('+'))
        .sort()
        .join(';');
    const hash = crypto.createHash('sha256').update(`${rackSig}::${boardSig}`).digest('hex').slice(0, 12);
    console.log(`[Scenario] Hash input — rack: "${rackSig}"`);
    console.log(`[Scenario] Hash input — board: "${boardSig}"`);
    console.log(`[Scenario] Hash result: ${hash}`);
    return hash;
}

// ---------------------------------------------------------------------------
// Lazy cache load — called automatically on first list/get request
// ---------------------------------------------------------------------------

async function ensureLoaded() {
    if (cacheLoaded) return;
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
        if (!HF_SCENARIOS_REPO || !HF_TOKEN) {
            cacheLoaded = true;
            return;
        }
        try {
            const index = await fetchFromHF('index.json');
            if (!Array.isArray(index) || index.length === 0) {
                console.log('[Scenario] index.json empty or missing — starting fresh.');
                cacheLoaded = true;
                return;
            }
            // Load all scenario files in parallel instead of sequentially
            const results = await Promise.all(
                index.filter(m => m.id).map(m => fetchFromHF(`scenario_${m.id}.json`))
            );
            results.forEach(full => { if (full) scenarioCache.set(full.id, full); });
            console.log(`[Scenario] Loaded ${scenarioCache.size} scenario(s) from HF.`);
            cacheLoaded = true; // only mark loaded on success
        } catch (err) {
            console.error('[Scenario] HF load failed — will retry on next request:', err.message);
            loadingPromise = null; // allow retry on next request
        }
    })();

    return loadingPromise;
}

// ---------------------------------------------------------------------------
// Save a scenario (fire-and-forget from optimize controller)
// ---------------------------------------------------------------------------

async function maybeSaveScenario(rack, board, algorithmTilesRemoved, createdBy = 'unknown') {
    if (!HF_SCENARIOS_REPO || !HF_TOKEN) return;

    const id = computeContentHash(rack, board);
    if (scenarioCache.has(id)) return;

    const difficulty = computeDifficulty(rack, board, algorithmTilesRemoved);
    const scenario = {
        id,
        rack,
        board,
        algorithmTilesRemoved,
        difficulty,
        createdBy,
        recordHolder: null,
        createdAt: new Date().toISOString(),
    };

    scenarioCache.set(id, scenario);
    console.log(`[Scenario] New scenario cached. id=${id}, tiles=${algorithmTilesRemoved}, difficulty=${difficulty}`);

    const meta = { id, algorithmTilesRemoved, difficulty, createdBy, recordHolder: null, createdAt: scenario.createdAt };

    uploadQueue = uploadQueue.then(async () => {
        const str = (data) => JSON.stringify(data, null, 2);
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const currentIndex = (await fetchFromHF('index.json')) || [];
                await uploadFiles({
                    repo: { type: 'dataset', name: HF_SCENARIOS_REPO },
                    credentials: { accessToken: HF_TOKEN },
                    files: [
                        {
                            path: `scenario_${id}.json`,
                            content: new Blob([str(scenario)], { type: 'application/json' }),
                        },
                        {
                            path: 'index.json',
                            content: new Blob([str([...currentIndex, meta])], { type: 'application/json' }),
                        },
                    ],
                    commitTitle: `Add scenario ${id}`,
                });
                console.log(`[Scenario] Uploaded to HF. id=${id}`);
                return;
            } catch (err) {
                if (err.statusCode === 412 && attempt < 3) {
                    await new Promise(r => setTimeout(r, attempt * 1000));
                } else {
                    throw err;
                }
            }
        }
    });
}

// ---------------------------------------------------------------------------
// List / Get
// ---------------------------------------------------------------------------

async function listScenarios() {
    await ensureLoaded();
    return Array.from(scenarioCache.values())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getScenario(id) {
    await ensureLoaded();
    if (scenarioCache.has(id)) return scenarioCache.get(id);

    // Cache miss — try HF directly
    const scenario = await fetchFromHF(`scenario_${id}.json`);
    if (!scenario) return null;
    scenarioCache.set(id, scenario);
    return scenario;
}

// ---------------------------------------------------------------------------
// Submit attempt
// ---------------------------------------------------------------------------

function countRackTilesPlaced(originalRack, submittedBoard) {
    const boardPool = submittedBoard.flat().map(normalizeTile);
    let placed = 0;
    const usedIndexes = new Set();
    for (const rackTile of originalRack) {
        const sig = normalizeTile(rackTile);
        const idx = boardPool.findIndex((s, i) => s === sig && !usedIndexes.has(i));
        if (idx !== -1) { usedIndexes.add(idx); placed++; }
    }
    return placed;
}

async function submitAttempt(scenarioId, userEmail, submittedBoard, tilesPlaced) {
    const scenario = await getScenario(scenarioId);
    if (!scenario) {
        const err = new Error('Scenario not found');
        err.statusCode = 404;
        throw err;
    }

    for (const group of submittedBoard) {
        if (!isValidRun(group) && !isValidSet(group)) {
            const err = new Error('Board contains an invalid group');
            err.statusCode = 400;
            err.type = 'ValidationError';
            throw err;
        }
    }

    const previousRecord = scenario.recordHolder?.tilesPlaced ?? 0;
    const isNewRecord = tilesPlaced > previousRecord;

    // Update leaderboard: one document per scenario, embedded entries array per user.
    // Step 1 — try to update existing user entry (increment attempts, update best score + date)
    const updated = await ScenarioLeaderboard.updateOne(
        { scenarioId, 'entries.email': userEmail },
        {
            $inc: { 'entries.$[e].attempts': 1 },
            $max: { 'entries.$[e].bestScore': tilesPlaced },
            $set: { 'entries.$[e].achievedAt': new Date() },
        },
        { arrayFilters: [{ 'e.email': userEmail }] }
    );

    // Step 2 — if user has no entry yet, push a new one (also creates the scenario doc if missing)
    if (updated.modifiedCount === 0) {
        await ScenarioLeaderboard.findOneAndUpdate(
            { scenarioId },
            { $push: { entries: { email: userEmail, bestScore: tilesPlaced, attempts: 1, achievedAt: new Date() } } },
            { upsert: true }
        );
    }

    if (isNewRecord) {
        const recordHolder = { email: userEmail, tilesPlaced, achievedAt: new Date().toISOString() };
        scenario.recordHolder = recordHolder;
        scenarioCache.set(scenarioId, scenario);

        uploadQueue = uploadQueue.then(async () => {
            const str = (data) => JSON.stringify(data, null, 2);
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const currentIndex = (await fetchFromHF('index.json')) || [];
                    const updatedIndex = currentIndex.map(m =>
                        m.id === scenarioId ? { ...m, recordHolder: { email: userEmail, tilesPlaced } } : m
                    );
                    await uploadFiles({
                        repo: { type: 'dataset', name: HF_SCENARIOS_REPO },
                        credentials: { accessToken: HF_TOKEN },
                        files: [
                            {
                                path: `scenario_${scenarioId}.json`,
                                content: new Blob([str(scenario)], { type: 'application/json' }),
                            },
                            {
                                path: 'index.json',
                                content: new Blob([str(updatedIndex)], { type: 'application/json' }),
                            },
                        ],
                        commitTitle: `New record: scenario ${scenarioId}`,
                    });
                    console.log(`[Scenario] New record saved. id=${scenarioId}, user=${userEmail}, tiles=${tilesPlaced}`);
                    return;
                } catch (err) {
                    if (err.statusCode === 412 && attempt < 3) {
                        await new Promise(r => setTimeout(r, attempt * 1000));
                    } else {
                        throw err;
                    }
                }
            }
        });
    }

    return { tilesPlaced, isNewRecord, previousRecord };
}

async function backfillDifficulty() {
    if (!HF_SCENARIOS_REPO || !HF_TOKEN) return;

    const toUpdate = Array.from(scenarioCache.values()).filter(s => !s.difficulty);
    if (toUpdate.length === 0) return;

    console.log(`[Scenario] Backfilling difficulty for ${toUpdate.length} scenario(s)...`);
    for (const scenario of toUpdate) {
        scenario.difficulty = computeDifficulty(scenario.rack, scenario.board, scenario.algorithmTilesRemoved);
        scenarioCache.set(scenario.id, scenario);
    }

    uploadQueue = uploadQueue.then(async () => {
        const str = (data) => JSON.stringify(data, null, 2);
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const currentIndex = (await fetchFromHF('index.json')) || [];
                const updatedIndex = currentIndex.map(m => {
                    const s = scenarioCache.get(m.id);
                    return s ? { ...m, difficulty: s.difficulty } : m;
                });
                await uploadFiles({
                    repo: { type: 'dataset', name: HF_SCENARIOS_REPO },
                    credentials: { accessToken: HF_TOKEN },
                    files: [
                        { path: 'index.json', content: new Blob([str(updatedIndex)], { type: 'application/json' }) },
                        ...toUpdate.map(s => ({
                            path: `scenario_${s.id}.json`,
                            content: new Blob([str(s)], { type: 'application/json' }),
                        })),
                    ],
                    commitTitle: `Backfill difficulty for ${toUpdate.length} scenario(s)`,
                });
                console.log(`[Scenario] Backfill complete. Updated ${toUpdate.length} scenario(s).`);
                return;
            } catch (err) {
                if (err.statusCode === 412 && attempt < 3) {
                    await new Promise(r => setTimeout(r, attempt * 1000));
                } else {
                    console.error('[Scenario] Backfill upload failed:', err.message);
                    return;
                }
            }
        }
    });
}

function loadScenariosFromHF() {
    ensureLoaded()
        .then(() => backfillDifficulty())
        .catch(err => console.error('[Scenario] Startup load failed:', err.message));
}

async function getScenarioLeaderboard(scenarioId) {
    const doc = await ScenarioLeaderboard.findOne({ scenarioId }).lean();
    if (!doc) return [];

    const entries = (doc.entries || []).sort((a, b) => b.bestScore - a.bestScore).slice(0, 50);

    const emails = entries.map(e => e.email).filter(Boolean);
    const users = await User.find({ email: { $in: emails } }, 'name email').lean();
    const nameByEmail = Object.fromEntries(users.map(u => [u.email, u.name]));

    return entries.map(e => ({ ...e, name: nameByEmail[e.email] ?? null }));
}

module.exports = { loadScenariosFromHF, maybeSaveScenario, listScenarios, getScenario, submitAttempt, getScenarioLeaderboard };
