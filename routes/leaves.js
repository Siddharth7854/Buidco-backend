const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');
const { 
  validateLeaveType, 
  validateDateRange, 
  calculateLeaveDays, 
  normalizeLeaveType,
  validateLeaveDays,
  validateEmployeeId,
  sanitizeInput
} = require('../utils/validation');

// Multer config for leave documents
const leaveDocsStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '..', 'uploads', 'leave_docs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const uploadLeaveDoc = multer({ 
  storage: leaveDocsStorage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image, PDF and document files are allowed'));
    }
  }
});

// Get all leaves
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        l.*,
        e.full_name as employee_name,
        e.department,
        e.position
      FROM leaves l
      JOIN employees e ON l.employee_id = e.employee_id
      ORDER BY l.created_at DESC
    `);
    
    res.json({ success: true, leaves: result.rows });
  } catch (err) {
    console.error('Error fetching leaves:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get leaves by employee ID
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    if (!validateEmployeeId(employeeId)) {
      return res.status(400).json({ success: false, message: 'Valid employee ID is required' });
    }
    
    const result = await pool.query(`
      SELECT 
        l.*,
        e.full_name as employee_name,
        e.department,
        e.position
      FROM leaves l
      JOIN employees e ON l.employee_id = e.employee_id
      WHERE LOWER(l.employee_id) = LOWER($1)
      ORDER BY l.created_at DESC
    `, [employeeId.trim()]);
    
    res.json({ success: true, leaves: result.rows });
  } catch (err) {
    console.error('Error fetching employee leaves:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get leave by ID
router.get('/:leaveId', async (req, res) => {
  try {
    const { leaveId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        l.*,
        e.full_name as employee_name,
        e.department,
        e.position
      FROM leaves l
      JOIN employees e ON l.employee_id = e.employee_id
      WHERE l.id = $1
    `, [leaveId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }
    
    res.json({ success: true, leave: result.rows[0] });
  } catch (err) {
    console.error('Error fetching leave:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create new leave request
router.post('/', uploadLeaveDoc.single('document'), async (req, res) => {
  try {
    const { 
      employee_id, 
      leave_type, 
      start_date, 
      end_date, 
      reason 
    } = req.body;

    // Validation
    if (!validateEmployeeId(employee_id)) {
      return res.status(400).json({ success: false, message: 'Valid employee ID is required' });
    }
    
    if (!validateLeaveType(leave_type)) {
      return res.status(400).json({ success: false, message: 'Valid leave type is required (CL, RH, EL)' });
    }
    
    if (!start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'Start date and end date are required' });
    }
    
    if (!validateDateRange(start_date, end_date)) {
      return res.status(400).json({ success: false, message: 'Invalid date range' });
    }
    
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Reason is required' });
    }

    // Check if employee exists
    const employeeCheck = await pool.query(
      'SELECT * FROM employees WHERE LOWER(employee_id) = LOWER($1)',
      [employee_id.trim()]
    );
    
    if (employeeCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const employee = employeeCheck.rows[0];
    const days = calculateLeaveDays(start_date, end_date);
    
    if (!validateLeaveDays(days, leave_type)) {
      return res.status(400).json({ success: false, message: 'Leave days exceed maximum limit' });
    }

    // Check leave balance
    const balanceField = `${leave_type.toLowerCase()}_balance`;
    if (employee[balanceField] < days) {
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient ${leave_type} balance. Available: ${employee[balanceField]}, Requested: ${days}` 
      });
    }

    // Check for overlapping leaves
    const overlappingLeaves = await pool.query(`
      SELECT * FROM leaves 
      WHERE employee_id = $1 
      AND status != 'REJECTED'
      AND (
        (start_date <= $2 AND end_date >= $2) OR
        (start_date <= $3 AND end_date >= $3) OR
        (start_date >= $2 AND end_date <= $3)
      )
    `, [employee_id.trim(), start_date, end_date]);
    
    if (overlappingLeaves.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Leave request overlaps with existing approved/pending leaves' });
    }

    // Insert leave request
    const documentPath = req.file ? req.file.path.replace(/\\/g, '/') : null;
    
    const result = await pool.query(`
      INSERT INTO leaves (
        employee_id, leave_type, start_date, end_date, days, reason, document_path
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      employee_id.trim(),
      normalizeLeaveType(leave_type),
      start_date,
      end_date,
      days,
      sanitizeInput(reason.trim()),
      documentPath
    ]);

    res.status(201).json({ success: true, leave: result.rows[0] });
  } catch (err) {
    console.error('Error creating leave request:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update leave status (approve/reject)
router.put('/:leaveId/status', async (req, res) => {
  try {
    const { leaveId } = req.params;
    const { status, approved_by } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be APPROVED or REJECTED' });
    }

    if (!approved_by) {
      return res.status(400).json({ success: false, message: 'Approver ID is required' });
    }

    // Get leave details
    const leaveResult = await pool.query(`
      SELECT l.*, e.${status === 'APPROVED' ? 'cl_balance, rh_balance, el_balance' : ''}
      FROM leaves l
      JOIN employees e ON l.employee_id = e.employee_id
      WHERE l.id = $1
    `, [leaveId]);

    if (leaveResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }

    const leave = leaveResult.rows[0];

    if (leave.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Leave is not in pending status' });
    }

    // Update leave status
    await pool.query(`
      UPDATE leaves 
      SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [status, approved_by, leaveId]);

    // If approved, update employee balance
    if (status === 'APPROVED') {
      const balanceField = `${leave.leave_type.toLowerCase()}_balance`;
      const newBalance = leave[balanceField] - leave.days;
      
      await pool.query(`
        UPDATE employees 
        SET ${balanceField} = $1
        WHERE employee_id = $2
      `, [newBalance, leave.employee_id]);
    }

    res.json({ success: true, message: `Leave ${status.toLowerCase()} successfully` });
  } catch (err) {
    console.error('Error updating leave status:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete leave request
router.delete('/:leaveId', async (req, res) => {
  try {
    const { leaveId } = req.params;

    // Get leave details
    const leaveResult = await pool.query('SELECT * FROM leaves WHERE id = $1', [leaveId]);
    
    if (leaveResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }

    const leave = leaveResult.rows[0];

    // Only allow deletion of pending leaves
    if (leave.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Only pending leaves can be deleted' });
    }

    // Delete associated document if exists
    if (leave.document_path && fs.existsSync(leave.document_path)) {
      fs.unlinkSync(leave.document_path);
    }

    // Delete leave
    await pool.query('DELETE FROM leaves WHERE id = $1', [leaveId]);

    res.json({ success: true, message: 'Leave request deleted successfully' });
  } catch (err) {
    console.error('Error deleting leave:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get leave statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_leaves,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_leaves,
        COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved_leaves,
        COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected_leaves,
        COUNT(CASE WHEN leave_type = 'CL' THEN 1 END) as cl_leaves,
        COUNT(CASE WHEN leave_type = 'RH' THEN 1 END) as rh_leaves,
        COUNT(CASE WHEN leave_type = 'EL' THEN 1 END) as el_leaves
      FROM leaves
    `);

    res.json({ success: true, stats: stats.rows[0] });
  } catch (err) {
    console.error('Error fetching leave statistics:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router; 