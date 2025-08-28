const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createDefaultAdmin } = require('./utils/helpers');
const keepAliveService = require('./services/keepAliveService');
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
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      // Production frontend URLs
      process.env.FRONTEND_URL,
      'https://ctrl-e-editing.vercel.app',
      'https://your-frontend-domain.vercel.app',
      // Development frontend URLs (always allow for testing)
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('⚠️ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

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
app.get('/', (req, res) => {
  res.json({
    message: 'Ctrl E Video Editing CRM Backend API',
    status: 'Running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/editor', editorRoutes);
app.use('/api/client', clientRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Ctrl E CRM API is running',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Ctrl E CRM API is running',
    timestamp: new Date().toISOString()
  });
});

// Keep-alive endpoint for external monitoring
app.get('/keep-alive', (req, res) => {
  res.status(200).json({
    status: 'ALIVE',
    message: 'Server is awake and running',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: {
      used: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
      heap: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB'
    },
    lastKeepAlive: new Date().toLocaleString()
  });
});

// Ping endpoint for simple monitoring
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// Keep-alive stats endpoint
app.get('/keep-alive-stats', (req, res) => {
  res.status(200).json(keepAliveService.getStats());
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

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌍 Server accessible at: http://0.0.0.0:${PORT}`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`🔗 Production URL: https://ctrleforediting-backend.onrender.com`);
    
    // Start keep-alive service in production
    setTimeout(() => {
      console.log('🚀 Starting keep-alive service for unlimited uptime...');
      keepAliveService.start();
    }, 5000); // Start after 5 seconds
  }
});

// Set server timeout to handle large file uploads (no timeout)
server.timeout = 0; // Disable timeout for file uploads to Google Drive
server.keepAliveTimeout = 0; // Disable keep-alive timeout
server.headersTimeout = 0; // Disable headers timeout

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  keepAliveService.stop();
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  keepAliveService.stop();
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});
