# 🚀 Employee Nexus Backend - Deployment Guide

This guide provides step-by-step instructions for deploying the Employee Nexus Backend API to production.

## 📋 Prerequisites

- **Node.js** v16 or higher
- **PostgreSQL** v12 or higher
- **npm** or **yarn**
- **PM2** (for process management)
- **Git** (for version control)

## 🛠️ Quick Start

### Option 1: Automated Deployment (Recommended)

#### Windows

```bash
# Navigate to backend directory
cd backend

# Run the deployment script
deploy.bat
```

#### Linux/macOS

```bash
# Navigate to backend directory
cd backend

# Make script executable
chmod +x deploy.sh

# Run the deployment script
./deploy.sh
```

### Option 2: Manual Deployment

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Environment Setup**

   ```bash
   # Copy environment template
   cp env.example .env

   # Edit with your configuration
   nano .env
   ```

3. **Database Setup**

   ```bash
   # Create database
   createdb buidco_leave

   # Or using psql
   psql -U postgres -c "CREATE DATABASE buidco_leave;"
   ```

4. **Start with PM2**

   ```bash
   # Install PM2 globally
   npm install -g pm2

   # Start application
   pm2 start server.js --name "employee-nexus-api"

   # Save configuration
   pm2 save

   # Setup auto-start
   pm2 startup
   ```

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

1. **Setup Environment**

   ```bash
   # Set database password
   export DB_PASSWORD=your_secure_password

   # Or create .env file
   echo "DB_PASSWORD=your_secure_password" > .env
   ```

2. **Start Services**

   ```bash
   # Start all services
   docker-compose up -d

   # View logs
   docker-compose logs -f
   ```

3. **Production with Nginx**
   ```bash
   # Start with nginx reverse proxy
   docker-compose --profile production up -d
   ```

### Manual Docker Build

```bash
# Build image
docker build -t employee-nexus-api .

# Run container
docker run -d \
  --name employee-nexus-api \
  -p 5000:5000 \
  -e DB_HOST=your_db_host \
  -e DB_PASSWORD=your_password \
  -v uploads:/app/uploads \
  employee-nexus-api
```

## 🔧 Configuration

### Environment Variables

| Variable                  | Description          | Default                 | Required |
| ------------------------- | -------------------- | ----------------------- | -------- |
| `DB_USER`                 | PostgreSQL username  | `postgres`              | Yes      |
| `DB_HOST`                 | Database host        | `localhost`             | Yes      |
| `DB_NAME`                 | Database name        | `buidco_leave`          | Yes      |
| `DB_PASSWORD`             | Database password    | -                       | Yes      |
| `DB_PORT`                 | Database port        | `5432`                  | No       |
| `PORT`                    | Server port          | `5000`                  | No       |
| `NODE_ENV`                | Environment          | `development`           | No       |
| `MAX_FILE_SIZE`           | Max file upload size | `10485760`              | No       |
| `RATE_LIMIT_MAX_REQUESTS` | Rate limit requests  | `100`                   | No       |
| `CORS_ORIGIN`             | Allowed origins      | `http://localhost:3000` | No       |

### Database Configuration

```sql
-- Create database
CREATE DATABASE buidco_leave;

-- Create user (optional)
CREATE USER nexus_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE buidco_leave TO nexus_user;
```

## 🔒 Security Checklist

- [ ] Change default database password
- [ ] Set strong JWT and session secrets
- [ ] Configure CORS origins properly
- [ ] Enable HTTPS in production
- [ ] Set up firewall rules
- [ ] Configure rate limiting
- [ ] Enable file upload restrictions
- [ ] Set up SSL certificates
- [ ] Configure backup strategy
- [ ] Monitor logs and errors

## 📊 Monitoring & Health Checks

### Health Endpoints

```bash
# Basic health check
curl http://localhost:5000/api/health

# System status
curl http://localhost:5000/api/system/health
```

### PM2 Monitoring

```bash
# View status
pm2 status

# View logs
pm2 logs employee-nexus-api

# Monitor resources
pm2 monit
```

### Docker Monitoring

```bash
# Container status
docker ps

# Container logs
docker logs employee-nexus-api

# Resource usage
docker stats
```

## 🔄 Updates & Maintenance

### Application Updates

```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Restart application
pm2 restart employee-nexus-api

# Or with Docker
docker-compose down
docker-compose up -d --build
```

### Database Backups

```bash
# Create backup
pg_dump -U postgres buidco_leave > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
psql -U postgres buidco_leave < backup_file.sql
```

### Log Rotation

```bash
# PM2 log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Failed**

   ```bash
   # Check PostgreSQL status
   sudo systemctl status postgresql

   # Check connection
   psql -U postgres -d buidco_leave -c "SELECT NOW();"
   ```

2. **Port Already in Use**

   ```bash
   # Find process using port
   lsof -i :5000

   # Kill process
   kill -9 <PID>
   ```

3. **Permission Denied**

   ```bash
   # Fix uploads directory permissions
   chmod 755 uploads
   chown -R nodejs:nodejs uploads
   ```

4. **Memory Issues**
   ```bash
   # Increase Node.js memory limit
   pm2 start server.js --name "employee-nexus-api" --max-memory-restart 1G
   ```

### Log Analysis

```bash
# View application logs
pm2 logs employee-nexus-api --lines 100

# View error logs
pm2 logs employee-nexus-api --err --lines 50

# Real-time monitoring
pm2 logs employee-nexus-api --follow
```

## 📈 Performance Optimization

### Database Optimization

```sql
-- Create indexes for better performance
CREATE INDEX idx_employees_employee_id ON employees(employee_id);
CREATE INDEX idx_leaves_employee_id ON leaves(employee_id);
CREATE INDEX idx_leaves_status ON leaves(status);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
```

### Application Optimization

```bash
# Enable clustering
pm2 start server.js --name "employee-nexus-api" -i max

# Set memory limits
pm2 start server.js --name "employee-nexus-api" --max-memory-restart 1G
```

### Nginx Optimization

```nginx
# Enable gzip compression
gzip on;
gzip_types text/plain application/json;

# Enable caching
location /api/ {
    proxy_cache_valid 200 1m;
    add_header X-Cache-Status $upstream_cache_status;
}
```

## 🔐 SSL/HTTPS Setup

### Using Let's Encrypt

```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Configure nginx
sudo nano /etc/nginx/sites-available/employee-nexus
```

### Self-Signed Certificate (Development)

```bash
# Generate certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem
```

## 📞 Support

For additional support:

1. Check the troubleshooting section above
2. Review application logs
3. Check system resources
4. Verify network connectivity
5. Contact the development team

## 📝 Changelog

### Version 1.0.0

- Initial production release
- Complete API endpoints
- Security middleware
- Data integrity checks
- File upload support
- Docker support
- PM2 process management
