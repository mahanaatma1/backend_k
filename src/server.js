require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { ensureDirectoryExists, getUploadsDir, cleanupOldFiles } = require('./utils/fileUtils');

// Ensure uploads directory exists
const uploadsDir = getUploadsDir();
ensureDirectoryExists(uploadsDir);
console.log('Uploads directory ready:', uploadsDir);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
connectDB();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Backend is running!' });
});

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Set up periodic cleanup of old files (every hour)
  setInterval(() => {
    cleanupOldFiles();
  }, 60 * 60 * 1000); // 1 hour
  
  console.log('File cleanup scheduled (every hour)');
});
