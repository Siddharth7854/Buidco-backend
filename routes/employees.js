const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { 
  validateEmployeeId, 
  validateEmail, 
  sanitizeInput,
  normalizeLeaveBalance 
} = require('../utils/validation');
const { normalizeEmployeeBalances } = require('../utils/database');

// Get all employees
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        employee_id, 
        full_name, 
        email, 
        department, 
        position, 
        hire_date,
        cl_balance,
        rh_balance,
        el_balance,
        is_admin,
        created_at
      FROM employees 
      ORDER BY full_name
    `);
    
    // Normalize balances for all employees
    const employees = result.rows.map(employee => ({
      ...employee,
      cl_balance: normalizeLeaveBalance(employee.cl_balance),
      rh_balance: normalizeLeaveBalance(employee.rh_balance),
      el_balance: normalizeLeaveBalance(employee.el_balance)
    }));
    
    res.json({ success: true, employees });
  } catch (err) {
    console.error('Error fetching employees:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get employee by ID
router.get('/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    if (!validateEmployeeId(employeeId)) {
      return res.status(400).json({ success: false, message: 'Valid employee ID is required' });
    }
    
    const result = await pool.query(
      'SELECT * FROM employees WHERE LOWER(employee_id) = LOWER($1)',
      [employeeId.trim()]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    
    const employee = result.rows[0];
    
    // Normalize balances before returning
    const normalizedEmployee = {
      ...employee,
      cl_balance: normalizeLeaveBalance(employee.cl_balance),
      rh_balance: normalizeLeaveBalance(employee.rh_balance),
      el_balance: normalizeLeaveBalance(employee.el_balance)
    };
    
    res.json({ success: true, employee: normalizedEmployee });
  } catch (err) {
    console.error('Error fetching employee:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create new employee
router.post('/', async (req, res) => {
  try {
    const { 
      employee_id, 
      full_name, 
      email, 
      department, 
      position, 
      hire_date,
      cl_balance = 30,
      rh_balance = 15,
      el_balance = 18,
      is_admin = false 
    } = req.body;

    // Validation
    if (!validateEmployeeId(employee_id)) {
      return res.status(400).json({ success: false, message: 'Valid employee ID is required' });
    }
    
    if (!full_name || full_name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Full name is required' });
    }
    
    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, message: 'Valid email is required' });
    }
    
    if (!department || department.trim() === '') {
      return res.status(400).json({ success: false, message: 'Department is required' });
    }
    
    if (!position || position.trim() === '') {
      return res.status(400).json({ success: false, message: 'Position is required' });
    }
    
    if (!hire_date) {
      return res.status(400).json({ success: false, message: 'Hire date is required' });
    }

    // Check if employee already exists
    const existingEmployee = await pool.query(
      'SELECT employee_id FROM employees WHERE LOWER(employee_id) = LOWER($1) OR LOWER(email) = LOWER($2)',
      [employee_id.trim(), email.trim()]
    );
    
    if (existingEmployee.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Employee ID or email already exists' });
    }

    // Insert new employee
    const result = await pool.query(`
      INSERT INTO employees (
        employee_id, full_name, email, department, position, hire_date,
        cl_balance, rh_balance, el_balance, is_admin
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      sanitizeInput(employee_id.trim()),
      sanitizeInput(full_name.trim()),
      email.trim().toLowerCase(),
      sanitizeInput(department.trim()),
      sanitizeInput(position.trim()),
      hire_date,
      normalizeLeaveBalance(cl_balance),
      normalizeLeaveBalance(rh_balance),
      normalizeLeaveBalance(el_balance),
      is_admin
    ]);

    res.status(201).json({ success: true, employee: result.rows[0] });
  } catch (err) {
    console.error('Error creating employee:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update employee
router.put('/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { 
      full_name, 
      email, 
      department, 
      position, 
      cl_balance, 
      rh_balance, 
      el_balance, 
      is_admin 
    } = req.body;

    if (!validateEmployeeId(employeeId)) {
      return res.status(400).json({ success: false, message: 'Valid employee ID is required' });
    }

    // Check if employee exists
    const existingEmployee = await pool.query(
      'SELECT * FROM employees WHERE LOWER(employee_id) = LOWER($1)',
      [employeeId.trim()]
    );
    
    if (existingEmployee.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (full_name !== undefined) {
      updateFields.push(`full_name = $${paramCount++}`);
      updateValues.push(sanitizeInput(full_name.trim()));
    }
    
    if (email !== undefined) {
      if (!validateEmail(email)) {
        return res.status(400).json({ success: false, message: 'Valid email is required' });
      }
      updateFields.push(`email = $${paramCount++}`);
      updateValues.push(email.trim().toLowerCase());
    }
    
    if (department !== undefined) {
      updateFields.push(`department = $${paramCount++}`);
      updateValues.push(sanitizeInput(department.trim()));
    }
    
    if (position !== undefined) {
      updateFields.push(`position = $${paramCount++}`);
      updateValues.push(sanitizeInput(position.trim()));
    }
    
    if (cl_balance !== undefined) {
      updateFields.push(`cl_balance = $${paramCount++}`);
      updateValues.push(normalizeLeaveBalance(cl_balance));
    }
    
    if (rh_balance !== undefined) {
      updateFields.push(`rh_balance = $${paramCount++}`);
      updateValues.push(normalizeLeaveBalance(rh_balance));
    }
    
    if (el_balance !== undefined) {
      updateFields.push(`el_balance = $${paramCount++}`);
      updateValues.push(normalizeLeaveBalance(el_balance));
    }
    
    if (is_admin !== undefined) {
      updateFields.push(`is_admin = $${paramCount++}`);
      updateValues.push(is_admin);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(employeeId.trim());

    const result = await pool.query(`
      UPDATE employees 
      SET ${updateFields.join(', ')}
      WHERE LOWER(employee_id) = LOWER($${paramCount})
      RETURNING *
    `, updateValues);

    res.json({ success: true, employee: result.rows[0] });
  } catch (err) {
    console.error('Error updating employee:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete employee
router.delete('/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;

    if (!validateEmployeeId(employeeId)) {
      return res.status(400).json({ success: false, message: 'Valid employee ID is required' });
    }

    const result = await pool.query(
      'DELETE FROM employees WHERE LOWER(employee_id) = LOWER($1) RETURNING *',
      [employeeId.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (err) {
    console.error('Error deleting employee:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Fix employee balances
router.post('/:employeeId/fix-balances', async (req, res) => {
  try {
    const { employeeId } = req.params;
    
    if (!validateEmployeeId(employeeId)) {
      return res.status(400).json({ success: false, message: 'Valid employee ID is required' });
    }
    
    // Check if employee exists
    const employeeCheck = await pool.query(
      'SELECT employee_id, full_name FROM employees WHERE LOWER(employee_id) = LOWER($1)',
      [employeeId.trim()]
    );
    
    if (employeeCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    
    // Normalize balances
    const normalizedBalances = await normalizeEmployeeBalances(employeeId.trim());
    
    res.json({
      success: true,
      message: 'Employee balances fixed successfully',
      employee: {
        employee_id: employeeId,
        full_name: employeeCheck.rows[0].full_name,
        ...normalizedBalances
      }
    });
  } catch (err) {
    console.error('Error fixing employee balances:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Bulk fix all employee balances
router.post('/fix-all-balances', async (req, res) => {
  try {
    // Get all employees
    const employees = await pool.query('SELECT employee_id, full_name FROM employees');
    
    const results = [];
    const errors = [];
    
    for (const employee of employees.rows) {
      try {
        const normalizedBalances = await normalizeEmployeeBalances(employee.employee_id);
        results.push({
          employee_id: employee.employee_id,
          full_name: employee.full_name,
          ...normalizedBalances
        });
      } catch (err) {
        errors.push({
          employee_id: employee.employee_id,
          full_name: employee.full_name,
          error: err.message
        });
      }
    }
    
    res.json({
      success: true,
      message: `Fixed balances for ${results.length} employees`,
      fixed: results.length,
      errors: errors.length,
      results,
      errors
    });
  } catch (err) {
    console.error('Error in bulk balance fix:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router; 