const multer = require('multer');

// Memory storage configuration for direct Google Drive upload
const memoryStorage = multer.memoryStorage();

// Base multer configuration for memory storage
const createMemoryUpload = (options = {}) => {
  const defaultOptions = {
    storage: memoryStorage,
    limits: {
      fileSize: 1000 * 1024 * 1024 // 1GB limit (can be adjusted)
    },
    fileFilter: options.fileFilter || ((req, file, cb) => {
      // Accept all file types by default
      cb(null, true);
    })
  };

  return multer({
    ...defaultOptions,
    ...options
  });
};

// Specific configurations for different use cases
const clientUpload = createMemoryUpload({
  fileFilter: (req, file, cb) => {
    console.log('🔍 Client file upload attempt:', {
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    // Accept all file types for client uploads
    console.log('✅ File type accepted:', file.originalname);
    return cb(null, true);
  }
});

const voiceUpload = createMemoryUpload({
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for voice messages
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /webm|mp3|wav|m4a|ogg|aac/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = file.mimetype.startsWith('audio/');

    if (mimetype || extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

const editorUpload = createMemoryUpload({
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit for edited videos
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|mov|avi|mkv|wmv|flv|webm/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = file.mimetype.startsWith('video/');

    if (mimetype || extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only video files are allowed for edited versions'));
    }
  }
});

module.exports = {
  clientUpload,
  voiceUpload,
  editorUpload,
  createMemoryUpload
};
