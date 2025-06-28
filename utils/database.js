const pool = require('../config/database');
const { normalizeLeaveBalance } = require('./validation');

// Balance normalization function
const normalizeEmployeeBalances = async (employeeId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get current balances
    const result = await client.query(
      'SELECT cl_balance, rh_balance, el_balance FROM employees WHERE employee_id = $1',
      [employeeId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Employee not found');
    }
    
    const employee = result.rows[0];
    
    // Normalize balances with reasonable limits
    const normalizedBalances = {
      cl_balance: Math.min(30, normalizeLeaveBalance(employee.cl_balance)), // Max 30 CL
      rh_balance: Math.min(15, normalizeLeaveBalance(employee.rh_balance)), // Max 15 RH
      el_balance: Math.min(18, normalizeLeaveBalance(employee.el_balance))  // Max 18 EL
    };
    
    // Update with normalized values
    await client.query(
      `UPDATE employees 
       SET cl_balance = $1, rh_balance = $2, el_balance = $3 
       WHERE employee_id = $4`,
      [normalizedBalances.cl_balance, normalizedBalances.rh_balance, normalizedBalances.el_balance, employeeId]
    );
    
    await client.query('COMMIT');
    console.log(`Normalized balances for employee ${employeeId}:`, normalizedBalances);
    return normalizedBalances;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error normalizing balances:', err);
    throw err;
  } finally {
    client.release();
  }
};

// Data integrity check function
const checkDataIntegrity = async () => {
  try {
    // Check for negative balances
    const negativeBalances = await pool.query(`
      SELECT employee_id, full_name, cl_balance, rh_balance, el_balance 
      FROM employees 
      WHERE cl_balance < 0 OR rh_balance < 0 OR el_balance < 0
    `);
    
    if (negativeBalances.rows.length > 0) {
      console.warn('Found employees with negative balances:', negativeBalances.rows);
      
      // Fix negative balances
      for (const employee of negativeBalances.rows) {
        await normalizeEmployeeBalances(employee.employee_id);
      }
    }
    
    // Check for unreasonably high balances
    const highBalances = await pool.query(`
      SELECT employee_id, full_name, cl_balance, rh_balance, el_balance 
      FROM employees 
      WHERE cl_balance > 30 OR rh_balance > 15 OR el_balance > 30
    `);
    
    if (highBalances.rows.length > 0) {
      console.warn('Found employees with high balances:', highBalances.rows);
      
      // Normalize high balances
      for (const employee of highBalances.rows) {
        await normalizeEmployeeBalances(employee.employee_id);
      }
    }
    
    console.log('Data integrity check completed');
  } catch (err) {
    console.error('Error in data integrity check:', err);
  }
};

// Create tables if they don't exist
const createTables = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create employees table
    await client.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        employee_id VARCHAR(50) UNIQUE NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        department VARCHAR(50) NOT NULL,
        position VARCHAR(50) NOT NULL,
        hire_date DATE NOT NULL,
        cl_balance INTEGER DEFAULT 30,
        rh_balance INTEGER DEFAULT 15,
        el_balance INTEGER DEFAULT 18,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create leaves table
    await client.query(`
      CREATE TABLE IF NOT EXISTS leaves (
        id SERIAL PRIMARY KEY,
        employee_id VARCHAR(50) NOT NULL,
        leave_type VARCHAR(10) NOT NULL CHECK (leave_type IN ('CL', 'RH', 'EL')),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        days INTEGER NOT NULL,
        reason TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
        approved_by VARCHAR(50),
        approved_at TIMESTAMP,
        document_path VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
      )
    `);

    // Create notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        user_id VARCHAR(50),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES employees(employee_id) ON DELETE CASCADE
      )
    `);

    await client.query('COMMIT');
    console.log('Database tables created successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating tables:', err);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  normalizeEmployeeBalances,
  checkDataIntegrity,
  createTables
}; 