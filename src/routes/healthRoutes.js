const express = require('express');
const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        message: 'Server is running'
    });
});

// Keep-alive endpoint
router.get('/ping', (req, res) => {
    res.status(200).json({
        message: 'pong',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
