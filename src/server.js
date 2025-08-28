const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createDefaultAdmin } = require('./utils/helpers');
require('dotenv').config();

console.log('🚀 Starting Ctrl E CRM Server...');
console.log('📍 Loading routes...');

// Import routes
const authRoutes = require('./routes/authRoutes');
console.log('✅ Auth routes loaded');
const adminRoutes = require('./routes/adminRoutes'); 
console.log('✅ Admin routes loaded');
const editorRoutes = require('./routes/editorRoutes');
console.log('✅ Editor routes loaded');
const clientRoutes = require('./routes/clientRoutes');
console.log('✅ Client routes loaded');

const app = express();
console.log('✅ Express app created');

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging
app.use(morgan('combined'));

// MongoDB connection
console.log('🔄 Attempting to connect to MongoDB...');
console.log('📍 MongoDB URI:', process.env.MONGODB_URI || 'mongodb://localhost:27017/ctrl-e-crm');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ctrl-e-crm', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('✅ Connected to MongoDB successfully');
  // Create default admin user if it doesn't exist
  await createDefaultAdmin();
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  console.log('⚠️  Server will continue running without database functionality');
  console.log('💡 To fix this:');
  console.log('   1. Install MongoDB locally, or');
  console.log('   2. Use MongoDB Atlas cloud service, or');
  console.log('   3. Update MONGODB_URI in your .env file');
});

// Handle MongoDB connection events
mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/editor', editorRoutes);
app.use('/api/client', clientRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Ctrl E CRM API is running',
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: Object.values(err.errors).map(e => e.message)
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Set server timeout to handle large file uploads (no timeout)
server.timeout = 0; // Disable timeout for file uploads to Google Drive
server.keepAliveTimeout = 0; // Disable keep-alive timeout
server.headersTimeout = 0; // Disable headers timeout
