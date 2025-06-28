const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import middleware and utilities
const { setupSecurity, corsOptions } = require('./middleware/security');
const { createTables, checkDataIntegrity } = require('./utils/database');

// Import routes
const employeesRouter = require('./routes/employees');
const leavesRouter = require('./routes/leaves');
const notificationsRouter = require('./routes/notifications');

const app = express();
const port = process.env.PORT || 5000;

// Security middleware setup
setupSecurity(app);

// CORS configuration
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/employees', employeesRouter);
app.use('/api/leaves', leavesRouter);
app.use('/api/notifications', notificationsRouter);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const pool = require('./config/database');
    const dbCheck = await pool.query('SELECT NOW()');
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      dbTimestamp: dbCheck.rows[0].now
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: err.message
    });
  }
});

// System health and data integrity status
app.get('/api/system/health', async (req, res) => {
  try {
    const pool = require('./config/database');
    
    // Check database connection
    const dbCheck = await pool.query('SELECT NOW()');
    
    // Check for data integrity issues
    const negativeBalances = await pool.query(`
      SELECT COUNT(*) as count FROM employees 
      WHERE cl_balance < 0 OR rh_balance < 0 OR el_balance < 0
    `);
    
    const highBalances = await pool.query(`
      SELECT COUNT(*) as count FROM employees 
      WHERE cl_balance > 30 OR rh_balance > 15 OR el_balance > 30
    `);
    
    const totalEmployees = await pool.query('SELECT COUNT(*) as count FROM employees');
    const totalLeaves = await pool.query('SELECT COUNT(*) as count FROM leaves');
    
    res.json({
      success: true,
      system: {
        database: 'connected',
        timestamp: dbCheck.rows[0].now
      },
      dataIntegrity: {
        totalEmployees: totalEmployees.rows[0].count,
        totalLeaves: totalLeaves.rows[0].count,
        negativeBalances: negativeBalances.rows[0].count,
        highBalances: highBalances.rows[0].count,
        needsAttention: (negativeBalances.rows[0].count > 0 || highBalances.rows[0].count > 0)
      }
    });
  } catch (err) {
    console.error('Error checking system health:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Employee Nexus Leave Management API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      system: '/api/system/health',
      employees: '/api/employees',
      leaves: '/api/leaves',
      notifications: '/api/notifications'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  // Handle multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'File too large. Maximum size is 10MB.'
    });
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Unexpected file field.'
    });
  }
  
  // Handle other errors
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Create database tables
    await createTables();
    console.log('Database tables initialized');
    
    // Run data integrity check after 5 seconds
    setTimeout(checkDataIntegrity, 5000);
    
    // Start server
    app.listen(port, () => {
      console.log(`🚀 Employee Nexus API Server running on port ${port}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${port}/api/health`);
      console.log(`📈 System status: http://localhost:${port}/api/system/health`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start the server
startServer(); 