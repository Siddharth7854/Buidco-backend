const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { validateEmployeeId, sanitizeInput } = require('../utils/validation');

// Get all notifications
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        n.*,
        e.full_name as user_name
      FROM notifications n
      LEFT JOIN employees e ON n.user_id = e.employee_id
      ORDER BY n.created_at DESC
    `);
    
    res.json({ success: true, notifications: result.rows });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get notifications by user ID
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!validateEmployeeId(userId)) {
      return res.status(400).json({ success: false, message: 'Valid user ID is required' });
    }
    
    const result = await pool.query(`
      SELECT 
        n.*,
        e.full_name as user_name
      FROM notifications n
      LEFT JOIN employees e ON n.user_id = e.employee_id
      WHERE n.user_id = $1 OR n.user_id IS NULL
      ORDER BY n.created_at DESC
    `, [userId.trim()]);
    
    res.json({ success: true, notifications: result.rows });
  } catch (err) {
    console.error('Error fetching user notifications:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get unread notifications count
router.get('/unread/count/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!validateEmployeeId(userId)) {
      return res.status(400).json({ success: false, message: 'Valid user ID is required' });
    }
    
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE (user_id = $1 OR user_id IS NULL) AND is_read = FALSE
    `, [userId.trim()]);
    
    res.json({ success: true, count: parseInt(result.rows[0].count) });
  } catch (err) {
    console.error('Error fetching unread count:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create new notification
router.post('/', async (req, res) => {
  try {
    const { type, message, user_id } = req.body;

    if (!type || type.trim() === '') {
      return res.status(400).json({ success: false, message: 'Notification type is required' });
    }
    
    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: 'Notification message is required' });
    }

    // If user_id is provided, validate it
    if (user_id && !validateEmployeeId(user_id)) {
      return res.status(400).json({ success: false, message: 'Valid user ID is required' });
    }

    const result = await pool.query(`
      INSERT INTO notifications (type, message, user_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [
      sanitizeInput(type.trim()),
      sanitizeInput(message.trim()),
      user_id ? user_id.trim() : null
    ]);

    res.status(201).json({ success: true, notification: result.rows[0] });
  } catch (err) {
    console.error('Error creating notification:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Mark notification as read
router.put('/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;

    const result = await pool.query(`
      UPDATE notifications 
      SET is_read = TRUE
      WHERE id = $1
      RETURNING *
    `, [notificationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, notification: result.rows[0] });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Mark all notifications as read for a user
router.put('/user/:userId/read-all', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!validateEmployeeId(userId)) {
      return res.status(400).json({ success: false, message: 'Valid user ID is required' });
    }

    const result = await pool.query(`
      UPDATE notifications 
      SET is_read = TRUE
      WHERE (user_id = $1 OR user_id IS NULL) AND is_read = FALSE
      RETURNING COUNT(*) as updated_count
    `, [userId.trim()]);

    res.json({ 
      success: true, 
      message: `Marked ${result.rows[0].updated_count} notifications as read` 
    });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete notification
router.delete('/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;

    const result = await pool.query(`
      DELETE FROM notifications 
      WHERE id = $1
      RETURNING *
    `, [notificationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete all notifications for a user
router.delete('/user/:userId/all', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!validateEmployeeId(userId)) {
      return res.status(400).json({ success: false, message: 'Valid user ID is required' });
    }

    const result = await pool.query(`
      DELETE FROM notifications 
      WHERE user_id = $1
      RETURNING COUNT(*) as deleted_count
    `, [userId.trim()]);

    res.json({ 
      success: true, 
      message: `Deleted ${result.rows[0].deleted_count} notifications` 
    });
  } catch (err) {
    console.error('Error deleting user notifications:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Test endpoint to create sample notifications
router.post('/test', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (userId && !validateEmployeeId(userId)) {
      return res.status(400).json({ success: false, message: 'Valid user ID is required' });
    }
    
    // Create some test notifications
    const testNotifications = [
      {
        type: 'Leave Approved',
        message: 'Your leave request for CL from 2024-01-15 to 2024-01-17 has been approved.',
        user_id: userId
      },
      {
        type: 'Leave Request',
        message: 'New leave request submitted by employee EMP001 for RH on 2024-01-20.',
        user_id: null // Global notification for admin
      },
      {
        type: 'System Update',
        message: 'System maintenance scheduled for tomorrow at 2:00 AM.',
        user_id: userId
      }
    ];

    const createdNotifications = [];
    for (const notification of testNotifications) {
      const result = await pool.query(
        'INSERT INTO notifications (type, message, user_id, is_read) VALUES ($1, $2, $3, FALSE) RETURNING *',
        [notification.type, notification.message, notification.user_id]
      );
      createdNotifications.push(result.rows[0]);
    }

    res.json({ 
      success: true, 
      message: 'Test notifications created successfully',
      count: createdNotifications.length,
      notifications: createdNotifications
    });
  } catch (err) {
    console.error('Error creating test notifications:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router; 