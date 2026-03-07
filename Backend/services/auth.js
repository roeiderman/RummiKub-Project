/**
 * Authentication Service - Business Logic
 */

const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../utils/tokenManager');
const { validatePasswordStrength } = require('../utils/passwordUtils');

/**
 * Register new user to the system and receive access and refresh tokens
 */
const register = async (userData) => {
    const { name, email, password, gender, dateOfBirth, photo } = userData;

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
        const error = new Error(passwordValidation.message);
        error.statusCode = 400;
        error.type = 'ValidationError';
        throw error;
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        const error = new Error('Email already registered');
        error.statusCode = 409;
        error.type = 'ConflictError';
        throw error;
    }

    // Create new user (password will be hashed by pre-save hook)
    const user = await User.create({
        name,
        email,
        password,
        gender,
        dateOfBirth,
        photo
    });

    // Generate tokens
    const accessToken = generateAccessToken(user._id, user.email);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token to user
    user.refreshToken = refreshToken;
    await user.save();

    return {
        user: user.toJSON(),
        accessToken,
        refreshToken
    };
};

/**
 * Login user to the system
 */
const login = async (email, password) => {
    // Find user and include password
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        error.type = 'AuthenticationError';
        throw error;
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
        const error = new Error('Invalid email or password');
        error.statusCode = 401;
        error.type = 'AuthenticationError';
        throw error;
    }

    // Update last login
    user.lastLogin = Date.now();

    // Generate tokens
    const accessToken = generateAccessToken(user._id, user.email);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    return {
        user: user.toJSON(),
        accessToken,
        refreshToken
    };
};

/**
 * Logout user
 */
const logout = async (userId) => {
    await User.findByIdAndUpdate(userId, { refreshToken: null });
    return { message: 'Logged out successfully' };
};

/**
 * Refresh access token, to receive a new access token using a valid refresh token
 */
const refreshAccessToken = async (refreshToken) => {
    try {
        // Verify refresh token
        const decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);

        // Find user with this refresh token
        const user = await User.findOne({ _id: decoded.userId, refreshToken }).select('+refreshToken');

        if (!user) {
            const error = new Error('Invalid refresh token');
            error.statusCode = 401;
            error.type = 'AuthenticationError';
            throw error;
        }

        // Generate new access token
        const accessToken = generateAccessToken(user._id, user.email);

        return { accessToken };
    } catch (error) {
        error.statusCode = 401;
        error.type = 'AuthenticationError';
        throw error;
    }
};

module.exports = {
    register,
    login,
    logout,
    refreshAccessToken
};
