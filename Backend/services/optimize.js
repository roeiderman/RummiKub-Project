/**
 * Rummikub Optimization Service
 * Handles board validation and move optimization for Rummikub gameplay
 */

const gameLogic = require('../utils/gameLogic');
const path = require('path');
const { spawn } = require('child_process');

/**
 * Validates that all groups on the board form valid Rummikub series
 * @param {Array} groups - Array of tile groups (each group is an array of tiles)
 * @returns {Object} Validation result with valid flag, errors, and valid groups
 */
function validateBoard(groups) {
    if (!groups || groups.length === 0) {
        return {
            valid: true,
            errors: [],
            validGroups: []
        };
    }

    const errors = [];
    const validGroups = [];

    groups.forEach((group, index) => {
        // Check minimum size requirement
        if (group.length < 3) {
            errors.push({
                groupIndex: index,
                tiles: group.map(t => t.tile || `${t.color}_${t.number}`),
                reason: 'Series requires minimum 3 tiles'
            });
            return;
        }

        // Validate as run or set
        const isRun = gameLogic.isValidRun(group);
        const isSet = gameLogic.isValidSet(group);

        if (!isRun && !isSet) {
            errors.push({
                groupIndex: index,
                tiles: group.map(t => t.tile || `${t.color}_${t.number}`),
                reason: 'Group is neither a valid run nor a valid set'
            });
        } else {
            validGroups.push({
                groupIndex: index,
                type: isRun ? 'run' : 'set',
                tiles: group
            });
        }
    });

    return {
        valid: errors.length === 0,
        errors,
        validGroups
    };
}

/**
 * Sends board and rack data to the Python solver and returns a Promise.
 */
function getRummikubSolution(rackArray, boardArrayOfArrays) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            rack: rackArray,
            board: boardArrayOfArrays
        });

        // Resolve absolute paths to ensure Node always finds the files
        // Adjust these paths based on where this JS file is relative to run_solver.py!
        const pythonExecutable = 'python'; // OR point to your venv: path.join(__dirname, '../solver_engine/venv/Scripts/python.exe')
        const scriptPath = path.join(__dirname, '../../solver_engine/run_solver.py');

        // Spawn the child process
        const pythonProcess = spawn(pythonExecutable, [scriptPath]);

        let outputData = '';
        let errorData = '';

        // Capture data printed by Python (stdout)
        pythonProcess.stdout.on('data', (data) => {
            outputData += data.toString();
        });

        // Capture crashes/errors from Python (stderr)
        pythonProcess.stderr.on('data', (data) => {
            errorData += data.toString();
        });

        // When the Python script finishes and closes
        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error("Python crashed with error:", errorData);
                return reject(new Error("Python script crashed"));
            }

            try {
                // Parse the JSON string that Python printed
                const result = JSON.parse(outputData);
                resolve(result);
            } catch (err) {
                console.error("Failed to parse Python output. Raw output was:", outputData);
                reject(new Error("Invalid JSON from Python"));
            }
        });

        // Send the JSON payload into Python's Standard Input
        pythonProcess.stdin.write(payload);
        pythonProcess.stdin.end(); // Tell Python we are done sending data
    });
}


module.exports = {
    validateBoard,
    getRummikubSolution
};
