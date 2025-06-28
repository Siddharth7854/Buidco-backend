#!/bin/bash

# Employee Nexus Backend Deployment Script
# This script helps deploy the backend to a production server

set -e  # Exit on any error

echo "🚀 Employee Nexus Backend Deployment Script"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js v16 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    print_error "Node.js version 16 or higher is required. Current version: $(node -v)"
    exit 1
fi

print_status "Node.js version: $(node -v)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi

print_status "npm version: $(npm -v)"

# Check if .env file exists
if [ ! -f .env ]; then
    print_warning ".env file not found. Creating from template..."
    if [ -f env.example ]; then
        cp env.example .env
        print_status "Created .env file from template. Please edit it with your configuration."
        print_warning "You need to edit .env file before continuing!"
        exit 1
    else
        print_error "env.example file not found. Please create .env file manually."
        exit 1
    fi
fi

# Install dependencies
print_status "Installing dependencies..."
npm install

# Check if PM2 is installed globally
if ! command -v pm2 &> /dev/null; then
    print_warning "PM2 is not installed. Installing PM2 globally..."
    npm install -g pm2
fi

print_status "PM2 version: $(pm2 -v)"

# Create uploads directory if it doesn't exist
if [ ! -d "uploads" ]; then
    print_status "Creating uploads directory..."
    mkdir -p uploads
fi

# Set proper permissions
print_status "Setting proper permissions..."
chmod 755 uploads
chmod 644 .env

# Test database connection
print_status "Testing database connection..."
if node -e "
const pool = require('./config/database');
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  }
  console.log('Database connection successful');
  process.exit(0);
});
"; then
    print_status "Database connection successful"
else
    print_error "Database connection failed. Please check your .env configuration."
    exit 1
fi

# Stop existing PM2 process if running
if pm2 list | grep -q "employee-nexus-api"; then
    print_status "Stopping existing PM2 process..."
    pm2 stop employee-nexus-api
    pm2 delete employee-nexus-api
fi

# Start the application with PM2
print_status "Starting application with PM2..."
pm2 start server.js --name "employee-nexus-api"

# Save PM2 configuration
print_status "Saving PM2 configuration..."
pm2 save

# Setup PM2 to start on boot
print_status "Setting up PM2 to start on boot..."
pm2 startup

print_status "Deployment completed successfully!"
echo ""
echo "📊 Application Status:"
pm2 status
echo ""
echo "📝 Useful Commands:"
echo "  pm2 logs employee-nexus-api          # View logs"
echo "  pm2 restart employee-nexus-api       # Restart application"
echo "  pm2 stop employee-nexus-api          # Stop application"
echo "  pm2 delete employee-nexus-api        # Remove from PM2"
echo ""
echo "🔗 Health Check:"
echo "  curl http://localhost:5000/api/health"
echo ""
echo "📈 System Status:"
echo "  curl http://localhost:5000/api/system/health" 