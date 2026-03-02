/**
 * Global Error Handler Middleware
 */

const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Default error response
    let statusCode = err.statusCode || 500;
    let errorType = err.type || 'InternalError';
    let message = err.message || 'Internal server error';
    let details = err.details || {};

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        errorType = 'ValidationError';
        message = Object.values(err.errors).map(e => e.message).join(', ');
    }

    if (err.code === 11000) {
        statusCode = 409;
        errorType = 'ConflictError';
        const field = Object.keys(err.keyPattern)[0];
        message = `${field} already exists`;
        details = { field };
    }

    if (err.name === 'CastError') {
        statusCode = 400;
        errorType = 'ValidationError';
        message = 'Invalid ID format';
    }

    // Send error response
    res.status(statusCode).json({
        success: false,
        error: {
            type: errorType,
            message: message,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
            ...(Object.keys(details).length > 0 && { details })
        }
    });
};

module.exports = errorHandler;
