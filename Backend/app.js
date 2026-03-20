/**
 * Rummikub Backend API
 * Main Express Application
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

// Import database connection
const connectDatabase = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const detectionRoutes = require('./routes/detection');
const optimizeRoutes = require('./routes/optimize');
const leaderboardRoutes = require('./routes/leaderboard');
const trainingRoutes = require('./routes/training');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDatabase();

// Security middleware
app.use(helmet());
app.use(cors());


// Request logging
app.use(morgan('dev'));

// Response compression
app.use(compression());

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve static files
app.use(express.static('public'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/detection', detectionRoutes);
app.use('/api/optimize', optimizeRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/training', trainingRoutes);


// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Rummikub API Server',
        version: '1.0.0',
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                logout: 'POST /api/auth/logout',
                refresh: 'POST /api/auth/refresh'
            },
            users: {
                profile: 'GET /api/users/profile',
                updateProfile: 'PUT /api/users/profile'
            },
            detection: {
                detect: 'POST /api/detection'
            }
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: {
            type: 'NotFoundError',
            message: 'Endpoint not found'
        }
    });
});

// Global error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log('🎮 Rummikub API Server');
    console.log(`${'='.repeat(60)}`);
    console.log(`✓ Server running on: http://localhost:${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`${'='.repeat(60)}\n`);
});

module.exports = app;