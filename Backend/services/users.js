/**
 * Users Service - Business Logic
 */

const User = require('../models/User');

/**
 * Get user profile
 */
const getProfile = async (userId) => {
    const user = await User.findById(userId);

    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        error.type = 'NotFoundError';
        throw error;
    }

    return user.toJSON();
};

/**
 * Update user profile
 */
const updateProfile = async (userId, updates) => {
    const { name, gender, dateOfBirth, photo } = updates;

    // Only allow specific fields to be updated
    const allowedUpdates = {};
    if (name !== undefined) allowedUpdates.name = name;
    if (gender !== undefined) allowedUpdates.gender = gender;
    if (dateOfBirth !== undefined) allowedUpdates.dateOfBirth = dateOfBirth;
    if (photo !== undefined) allowedUpdates.photo = photo;

    const user = await User.findByIdAndUpdate(
        userId,
        allowedUpdates,
        { new: true, runValidators: true }
    );

    if (!user) {
        const error = new Error('User not found');
        error.statusCode = 404;
        error.type = 'NotFoundError';
        throw error;
    }

    return user.toJSON();
};

module.exports = {
    getProfile,
    updateProfile
};
