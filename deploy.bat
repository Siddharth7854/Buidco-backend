@echo off
setlocal enabledelayedexpansion

echo 🚀 Employee Nexus Backend Deployment Script
echo ==========================================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js v16 or higher.
    pause
    exit /b 1
)

echo [INFO] Node.js version: 
node --version

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed
    pause
    exit /b 1
)

echo [INFO] npm version:
npm --version

REM Check if .env file exists
if not exist .env (
    echo [WARNING] .env file not found. Creating from template...
    if exist env.example (
        copy env.example .env >nul
        echo [INFO] Created .env file from template. Please edit it with your configuration.
        echo [WARNING] You need to edit .env file before continuing!
        pause
        exit /b 1
    ) else (
        echo [ERROR] env.example file not found. Please create .env file manually.
        pause
        exit /b 1
    )
)

REM Install dependencies
echo [INFO] Installing dependencies...
call npm install

REM Check if PM2 is installed globally
pm2 --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] PM2 is not installed. Installing PM2 globally...
    call npm install -g pm2
)

echo [INFO] PM2 version:
pm2 --version

REM Create uploads directory if it doesn't exist
if not exist uploads (
    echo [INFO] Creating uploads directory...
    mkdir uploads
)

REM Test database connection
echo [INFO] Testing database connection...
node -e "const pool = require('./config/database'); pool.query('SELECT NOW()', (err, res) => { if (err) { console.error('Database connection failed:', err.message); process.exit(1); } console.log('Database connection successful'); process.exit(0); });"
if %errorlevel% neq 0 (
    echo [ERROR] Database connection failed. Please check your .env configuration.
    pause
    exit /b 1
)

echo [INFO] Database connection successful

REM Stop existing PM2 process if running
pm2 list | findstr "employee-nexus-api" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Stopping existing PM2 process...
    pm2 stop employee-nexus-api
    pm2 delete employee-nexus-api
)

REM Start the application with PM2
echo [INFO] Starting application with PM2...
pm2 start server.js --name "employee-nexus-api"

REM Save PM2 configuration
echo [INFO] Saving PM2 configuration...
pm2 save

REM Setup PM2 to start on boot
echo [INFO] Setting up PM2 to start on boot...
pm2 startup

echo [INFO] Deployment completed successfully!
echo.
echo 📊 Application Status:
pm2 status
echo.
echo 📝 Useful Commands:
echo   pm2 logs employee-nexus-api          # View logs
echo   pm2 restart employee-nexus-api       # Restart application
echo   pm2 stop employee-nexus-api          # Stop application
echo   pm2 delete employee-nexus-api        # Remove from PM2
echo.
echo 🔗 Health Check:
echo   curl http://localhost:5000/api/health
echo.
echo 📈 System Status:
echo   curl http://localhost:5000/api/system/health
echo.
pause 