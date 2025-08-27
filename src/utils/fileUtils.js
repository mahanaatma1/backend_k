const fs = require('fs');
const path = require('path');

/**
 * Safely delete a file if it exists
 * @param {string} filePath - Path to the file to delete
 * @returns {boolean} - True if file was deleted or didn't exist, false if error
 */
const safeDeleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Successfully deleted file:', filePath);
      return true;
    }
    return true; // File didn't exist, which is fine
  } catch (error) {
    console.error('Error deleting file:', filePath, error);
    return false;
  }
};

/**
 * Ensure a directory exists, create if it doesn't
 * @param {string} dirPath - Path to the directory
 * @returns {boolean} - True if directory exists or was created
 */
const ensureDirectoryExists = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log('Created directory:', dirPath);
    }
    return true;
  } catch (error) {
    console.error('Error creating directory:', dirPath, error);
    return false;
  }
};

/**
 * Get the uploads directory path
 * @returns {string} - Path to uploads directory
 */
const getUploadsDir = () => {
  return path.join(__dirname, '..', '..', 'uploads');
};

/**
 * Clean up old files in uploads directory (older than 1 hour)
 * @returns {number} - Number of files deleted
 */
const cleanupOldFiles = () => {
  const uploadsDir = getUploadsDir();
  let deletedCount = 0;
  
  try {
    if (!fs.existsSync(uploadsDir)) {
      return 0;
    }
    
    const files = fs.readdirSync(uploadsDir);
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    files.forEach(file => {
      const filePath = path.join(uploadsDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile() && stats.mtime.getTime() < oneHourAgo) {
        if (safeDeleteFile(filePath)) {
          deletedCount++;
        }
      }
    });
    
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} old files from uploads directory`);
    }
  } catch (error) {
    console.error('Error during file cleanup:', error);
  }
  
  return deletedCount;
};

module.exports = {
  safeDeleteFile,
  ensureDirectoryExists,
  getUploadsDir,
  cleanupOldFiles
};
