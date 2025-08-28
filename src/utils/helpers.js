const User = require('../models/User');

/**
 * Create default admin user if it doesn't exist
 */
const createDefaultAdmin = async () => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    
    if (!adminExists) {
      const defaultAdmin = await User.create({
        name: 'System Administrator',
        email: process.env.ADMIN_EMAIL || 'admin@ctrle.com',
        phone: '+1234567890',
        password: process.env.ADMIN_PASSWORD || 'Admin@123',
        role: 'admin'
      });

      console.log('✅ Default admin user created:');
      console.log(`   Email: ${defaultAdmin.email}`);
      console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'Admin@123'}`);
      console.log('   ⚠️  Please change the password after first login!');
    }
  } catch (error) {
    console.error('❌ Error creating default admin:', error);
  }
};

/**
 * Format response with consistent structure
 */
const formatResponse = (success, message, data = null, errors = null) => {
  const response = { success, message };
  
  if (data) {
    if (typeof data === 'object' && !Array.isArray(data)) {
      Object.assign(response, data);
    } else {
      response.data = data;
    }
  }
  
  if (errors) {
    response.errors = errors;
  }
  
  return response;
};

/**
 * Generate random string for passwords, tokens, etc.
 */
const generateRandomString = (length = 8, includeSpecial = true) => {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  
  let chars = lowercase + uppercase + numbers;
  if (includeSpecial) chars += special;
  
  let result = '';
  // Ensure at least one char from each category
  result += lowercase[Math.floor(Math.random() * lowercase.length)];
  result += uppercase[Math.floor(Math.random() * uppercase.length)];
  result += numbers[Math.floor(Math.random() * numbers.length)];
  if (includeSpecial) {
    result += special[Math.floor(Math.random() * special.length)];
  }
  
  // Fill the rest randomly
  for (let i = result.length; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  
  // Shuffle the result
  return result.split('').sort(() => 0.5 - Math.random()).join('');
};

/**
 * Validate file types
 */
const validateFileType = (filename, allowedTypes) => {
  const fileExtension = filename.split('.').pop().toLowerCase();
  return allowedTypes.includes(fileExtension);
};

/**
 * Format file size
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Get status display text
 */
const getStatusDisplayText = (status) => {
  const statusMap = {
    'uploaded': 'Files Uploaded',
    'assigned': 'Assigned to Editor',
    'in_progress': 'Work in Progress',
    'completed': 'Editing Completed',
    'under_review': 'Under Admin Review',
    'approved': 'Approved by Admin',
    'revision_requested': 'Revision Requested',
    'revision_in_progress': 'Revision in Progress',
    'delivered': 'Project Delivered'
  };
  
  return statusMap[status] || status;
};

/**
 * Get status color for UI
 */
const getStatusColor = (status) => {
  const colorMap = {
    'uploaded': 'blue',
    'assigned': 'yellow',
    'in_progress': 'orange',
    'completed': 'green',
    'under_review': 'purple',
    'approved': 'green',
    'revision_requested': 'red',
    'revision_in_progress': 'orange',
    'delivered': 'green'
  };
  
  return colorMap[status] || 'gray';
};

/**
 * Clean up temporary files
 */
const cleanupTempFiles = (filePaths) => {
  const fs = require('fs');
  
  filePaths.forEach(filePath => {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        console.error('Error deleting temp file:', filePath, error);
      }
    }
  });
};

/**
 * Sanitize filename for safe storage
 */
const sanitizeFilename = (filename) => {
  return filename
    .replace(/[^a-z0-9.\-_]/gi, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
};

/**
 * Get project status steps
 */
const getProjectSteps = () => {
  return [
    { key: 'uploaded', label: 'Files Uploaded', description: 'Client has uploaded project files' },
    { key: 'assigned', label: 'Assigned', description: 'Project assigned to an editor' },
    { key: 'in_progress', label: 'In Progress', description: 'Editor is working on the project' },
    { key: 'completed', label: 'Completed', description: 'Editor has finished editing' },
    { key: 'approved', label: 'Approved', description: 'Admin approved and sent to client' },
    { key: 'delivered', label: 'Delivered', description: 'Client approved the final result' }
  ];
};

module.exports = {
  createDefaultAdmin,
  formatResponse,
  generateRandomString,
  validateFileType,
  formatFileSize,
  getStatusDisplayText,
  getStatusColor,
  cleanupTempFiles,
  sanitizeFilename,
  getProjectSteps
};
