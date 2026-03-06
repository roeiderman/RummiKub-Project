/**
 * Authentication Controller
 */

const authService = require('../services/auth');

/**
 * Register new user
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
    try {
        const result = await authService.register(req.body);

        res.status(201).json({
            success: true,
            data: result,
            message: 'User registered successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            const error = new Error('Email and password are required');
            error.statusCode = 400;
            error.type = 'ValidationError';
            throw error;
        }

        const result = await authService.login(email, password);

        res.status(200).json({
            success: true,
            data: result,
            message: 'Logged in successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Logout user
 * POST /api/auth/logout
 */
const logout = async (req, res, next) => {
    try {
        await authService.logout(req.userId);

        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
const refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            const error = new Error('Refresh token is required');
            error.statusCode = 400;
            error.type = 'ValidationError';
            throw error;
        }

        const result = await authService.refreshAccessToken(refreshToken);

        res.status(200).json({
            success: true,
            data: result,
            message: 'Token refreshed successfully'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    register,
    login,
    logout,
    refresh
};
