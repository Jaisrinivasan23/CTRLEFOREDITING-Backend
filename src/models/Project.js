const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  // Client Type and Basic Info
  clientType: {
    type: String,
    enum: ['new', 'existing'],
    required: [true, 'Client type is required']
  },
  clientName: {
    type: String,
    required: [true, 'Client name is required'],
    trim: true,
    maxlength: [100, 'Client name cannot exceed 100 characters']
  },
  clientPhone: {
    type: String,
    required: [true, 'Client phone is required'],
    match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
  },
  clientEmail: {
    type: String,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email'
    ]
  },
  
  // New Client Specific Fields
  brandName: {
    type: String,
    trim: true,
    maxlength: [100, 'Brand name cannot exceed 100 characters']
  },
  videoType: {
    type: String,
    enum: ['YouTube Video', 'Instagram Reel', 'Other']
  },
  hasScript: {
    type: String,
    enum: ['yes', 'no']
  },
  uploadLinks: {
    type: String,
    trim: true
  },
  contentCount: {
    type: String,
    trim: true
  },
  logoFiles: {
    type: String,
    trim: true
  },
  referenceLinks: {
    type: String,
    trim: true
  },
  musicPreferences: {
    type: String,
    trim: true
  },
  
  // Common Fields
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  
  // Existing Client Specific Fields
  specialInstructions: {
    type: String,
    trim: true
  },
  
  // General Project Fields
  notes: {
    type: String,
    trim: true
  },
  deadline: {
    type: Date
  },
  status: {
    type: String,
    enum: [
      'uploaded',       // Client uploaded files
      'assigned',       // Assigned to editor
      'reassigned',     // Reassigned to different editor
      'in_progress',    // Editor working
      'completed',      // Editor completed
      'under_review',   // Admin reviewing
      'approved',       // Admin approved, sent to client
      'revision_requested', // Client requested changes
      'revision_in_progress', // Editor working on revisions
      'client_reedit',  // Client requested re-edit
      'delivered'       // Final delivery
    ],
    default: 'uploaded'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  assignedEditor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedDate: Date,
  editorDeadlineHours: {
    type: Number,
    min: 1,
    max: 720, // Maximum 30 days (720 hours)
    default: 24
  },
  editorDeadline: {
    type: Date
  },
  isEditorDeadlineExceeded: {
    type: Boolean,
    default: false
  },
  dueDate: Date,
  uploadedFiles: [{
    filename: String,
    originalName: String,
    size: Number,
    mimeType: String,
    driveFileId: String,
    fileType: {
      type: String,
      enum: ['regular', 'voice'],
      default: 'regular'
    },
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  editedVersions: [{
    version: {
      type: Number,
      required: true
    },
    filename: String,
    driveFileId: String,
    driveFileUrl: String,
    uploadDate: {
      type: Date,
      default: Date.now
    },
    notes: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    }
  }],
  // Editor Adobe Video Link
  adobeVideoLink: {
    url: String,
    addedDate: {
      type: Date,
      default: Date.now
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String
  },
  driveFolderId: {
    type: String,
    required: true
  },
  driveFolderUrl: String,
  clientUploadFolderId: String,
  voiceFilesFolderId: String,
  voiceMessagesFolderId: String, // New folder for comment voice messages
  editedVersionsFolderId: String,
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  timeline: [{
    action: String,
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    notes: String,
    data: mongoose.Schema.Types.Mixed
  }],
  adminNotes: String,
  adminComments: [{
    comment: String,
    voiceMessage: {
      driveFileId: String,
      driveFileUrl: String,
      filename: String,
      duration: Number // in seconds
    },
    date: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['assignment', 'reassignment', 'review', 'general'],
      default: 'general'
    }
  }],
  clientFeedback: [{
    message: String,
    voiceMessage: {
      driveFileId: String,
      driveFileUrl: String,
      filename: String,
      duration: Number // in seconds
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    version: Number,
    status: {
      type: String,
      enum: ['approved', 'revision_requested'],
      required: true
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    satisfied: Boolean,
    reEditRequested: {
      type: Boolean,
      default: false
    },
    reEditComments: String
  }],
  publicId: {
    type: String,
    unique: true,
    required: true
  }
}, {
  timestamps: true
});

// Index for better query performance
projectSchema.index({ status: 1, assignedEditor: 1 });
projectSchema.index({ clientPhone: 1 });
projectSchema.index({ publicId: 1 });
projectSchema.index({ createdAt: -1 });

// Generate public ID for client access
projectSchema.pre('save', function(next) {
  if (!this.publicId) {
    this.publicId = 'CE' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
  }
  next();
});

// Add timeline entry method
projectSchema.methods.addTimelineEntry = function(action, user, notes = '', data = {}) {
  this.timeline.push({
    action,
    user,
    notes,
    data
  });
  return this.save();
};

// Update status method
projectSchema.methods.updateStatus = function(newStatus, user, notes = '') {
  const oldStatus = this.status;
  this.status = newStatus;
  
  return this.addTimelineEntry(
    `Status changed from ${oldStatus} to ${newStatus}`,
    user,
    notes
  );
};

// Get latest version
projectSchema.methods.getLatestVersion = function() {
  if (this.editedVersions.length === 0) return null;
  return this.editedVersions.reduce((latest, current) => 
    current.version > latest.version ? current : latest
  );
};

// Check if editor deadline is exceeded
projectSchema.methods.checkEditorDeadline = function() {
  if (!this.editorDeadline || !this.assignedEditor) return false;
  
  const now = new Date();
  const isExceeded = now > this.editorDeadline && 
    ['assigned', 'reassigned', 'in_progress'].includes(this.status);
  
  if (isExceeded && !this.isEditorDeadlineExceeded) {
    this.isEditorDeadlineExceeded = true;
    this.save();
  }
  
  return isExceeded;
};

// Get remaining time for editor deadline
projectSchema.methods.getEditorDeadlineInfo = function() {
  if (!this.editorDeadline) return null;
  
  const now = new Date();
  const timeLeft = this.editorDeadline - now;
  const hoursLeft = Math.ceil(timeLeft / (1000 * 60 * 60));
  
  return {
    deadline: this.editorDeadline,
    hoursLeft: Math.max(0, hoursLeft),
    isExceeded: timeLeft <= 0,
    totalHours: this.editorDeadlineHours
  };
};

module.exports = mongoose.model('Project', projectSchema);
