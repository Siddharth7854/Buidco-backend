// Validation functions
const validateLeaveType = (type) => {
  const normalizedType = (type || '').toUpperCase().trim();
  return ['CL', 'RH', 'EL'].includes(normalizedType);
};

const validateLeaveBalance = (balance) => {
  return typeof balance === 'number' && balance >= 0 && balance <= 365; // Max 1 year
};

const normalizeLeaveBalance = (balance) => {
  if (balance === null || balance === undefined) return 0;
  const numBalance = parseInt(balance);
  return isNaN(numBalance) ? 0 : Math.max(0, numBalance);
};

const validateDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return start >= today && end >= start;
};

const calculateLeaveDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Set time to midnight to avoid timezone issues
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const days = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, days); // Minimum 1 day
};

const normalizeLeaveType = (type) => {
  const normalizedType = (type || '').toUpperCase().trim();
  if (['CL', 'RH', 'EL'].includes(normalizedType)) {
    return normalizedType;
  }
  return null;
};

const validateLeaveDays = (days, leaveType) => {
  if (typeof days !== 'number' || days < 1) {
    return false;
  }
  
  // Set reasonable limits for different leave types
  const maxDays = {
    'CL': 30, // Max 30 days for casual leave
    'RH': 15, // Max 15 days for restricted holiday
    'EL': 60  // Max 60 days for earned leave
  };
  
  return days <= maxDays[leaveType] || 30; // Default max 30 days
};

const validateEmployeeId = (employeeId) => {
  return employeeId && employeeId.trim() !== '';
};

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>]/g, '');
};

module.exports = {
  validateLeaveType,
  validateLeaveBalance,
  normalizeLeaveBalance,
  validateDateRange,
  calculateLeaveDays,
  normalizeLeaveType,
  validateLeaveDays,
  validateEmployeeId,
  validateEmail,
  sanitizeInput
}; 