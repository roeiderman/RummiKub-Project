/**
 * Users Controller
 */

const usersService = require('../services/users');

/**
 * Get current user profile
 * GET /api/users/profile
 */
const getProfile = async (req, res, next) => {
    try {
        const user = await usersService.getProfile(req.userId);

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update user profile
 * PUT /api/users/profile
 */
const updateProfile = async (req, res, next) => {
    try {
        const user = await usersService.updateProfile(req.userId, req.body);

        res.status(200).json({
            success: true,
            data: user,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get user statistics
 * GET /api/users/statistics
 */
const getStatistics = async (req, res, next) => {
    try {
        const statistics = await usersService.getUserStatistics(req.userId);

        res.status(200).json({
            success: true,
            data: statistics
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getProfile,
    updateProfile,
    getStatistics
};