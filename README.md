# Employee Nexus Backend API

A robust Node.js/Express backend API for the Employee Nexus Leave Management System.

## 🚀 Features

- **Employee Management**: CRUD operations for employee data
- **Leave Management**: Request, approve, and track leave applications
- **Notification System**: Real-time notifications for users
- **File Upload**: Support for leave document attachments
- **Data Integrity**: Automatic balance normalization and validation
- **Security**: Rate limiting, CORS, input validation, and sanitization
- **Health Monitoring**: System health checks and data integrity monitoring

## 📋 Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd employee-buidco-main/backend
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Setup**

   ```bash
   # Copy the example environment file
   cp env.example .env

   # Edit .env with your configuration
   nano .env
   ```

4. **Database Setup**

   ```bash
   # Create PostgreSQL database
   createdb buidco_leave

   # Or using psql
   psql -U postgres
   CREATE DATABASE buidco_leave;
   ```

5. **Environment Variables**

   ```env
   # Database Configuration
   DB_USER=postgres
   DB_HOST=localhost
   DB_NAME=buidco_leave
   DB_PASSWORD=your_password_here
   DB_PORT=5432

   # Server Configuration
   PORT=5000
   NODE_ENV=production

   # Security
   JWT_SECRET=your_jwt_secret_here
   SESSION_SECRET=your_session_secret_here

   # File Upload
   MAX_FILE_SIZE=10485760
   UPLOAD_PATH=./uploads

   # Rate Limiting
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100

   # CORS
   CORS_ORIGIN=http://localhost:3000,https://yourdomain.com
   ```

## 🏃‍♂️ Running the Application

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

### Health Check

```bash
curl http://localhost:5000/api/health
```

## 📁 Project Structure

```
backend/
├── config/
│   └── database.js          # Database configuration
├── middleware/
│   └── security.js          # Security middleware
├── routes/
│   ├── employees.js         # Employee routes
│   ├── leaves.js           # Leave management routes
│   └── notifications.js    # Notification routes
├── utils/
│   ├── validation.js       # Input validation utilities
│   └── database.js         # Database utility functions
├── uploads/                # File upload directory
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── env.example            # Environment variables template
└── README.md             # This file
```

## 🔌 API Endpoints

### Health & System

- `GET /api/health` - Health check
- `GET /api/system/health` - System status and data integrity

### Employees

- `GET /api/employees` - Get all employees
- `GET /api/employees/:id` - Get employee by ID
- `POST /api/employees` - Create new employee
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee
- `POST /api/employees/:id/fix-balances` - Fix employee balances
- `POST /api/employees/fix-all-balances` - Fix all employee balances

### Leaves

- `GET /api/leaves` - Get all leaves
- `GET /api/leaves/employee/:id` - Get leaves by employee
- `GET /api/leaves/:id` - Get leave by ID
- `POST /api/leaves` - Create leave request
- `PUT /api/leaves/:id/status` - Update leave status
- `DELETE /api/leaves/:id` - Delete leave request
- `GET /api/leaves/stats/overview` - Leave statistics

### Notifications

- `GET /api/notifications` - Get all notifications
- `GET /api/notifications/user/:id` - Get user notifications
- `GET /api/notifications/unread/count/:id` - Get unread count
- `POST /api/notifications` - Create notification
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/user/:id/read-all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification

## 🔒 Security Features

- **Rate Limiting**: Prevents abuse with configurable limits
- **CORS Protection**: Configurable cross-origin resource sharing
- **Input Validation**: Comprehensive input sanitization
- **File Upload Security**: File type and size restrictions
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Input sanitization and output encoding

## 📊 Data Integrity

The system includes automatic data integrity checks:

- **Balance Normalization**: Ensures leave balances are within reasonable limits
- **Negative Balance Detection**: Identifies and fixes negative balances
- **High Balance Detection**: Normalizes unreasonably high balances
- **Overlap Detection**: Prevents overlapping leave requests

## 🚀 Deployment

### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start the application
pm2 start server.js --name "employee-nexus-api"

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### Using Docker

```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
```

### Using Systemd

```ini
[Unit]
Description=Employee Nexus API
After=network.target

[Service]
Type=simple
User=node
WorkingDirectory=/path/to/backend
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## 📝 Environment Variables

| Variable                  | Description          | Default                 |
| ------------------------- | -------------------- | ----------------------- |
| `DB_USER`                 | PostgreSQL username  | `postgres`              |
| `DB_HOST`                 | Database host        | `localhost`             |
| `DB_NAME`                 | Database name        | `buidco_leave`          |
| `DB_PASSWORD`             | Database password    | Required                |
| `DB_PORT`                 | Database port        | `5432`                  |
| `PORT`                    | Server port          | `5000`                  |
| `NODE_ENV`                | Environment          | `development`           |
| `MAX_FILE_SIZE`           | Max file upload size | `10485760` (10MB)       |
| `RATE_LIMIT_MAX_REQUESTS` | Rate limit requests  | `100`                   |
| `CORS_ORIGIN`             | Allowed origins      | `http://localhost:3000` |

## 🔧 Troubleshooting

### Common Issues

1. **Database Connection Error**

   - Verify PostgreSQL is running
   - Check database credentials in `.env`
   - Ensure database exists

2. **Port Already in Use**

   - Change `PORT` in `.env`
   - Kill process using the port: `lsof -ti:5000 | xargs kill`

3. **File Upload Issues**

   - Check `uploads` directory permissions
   - Verify `MAX_FILE_SIZE` setting
   - Ensure file type is allowed

4. **CORS Errors**
   - Update `CORS_ORIGIN` in `.env`
   - Add your frontend domain to allowed origins

### Logs

```bash
# View application logs
pm2 logs employee-nexus-api

# View real-time logs
pm2 logs employee-nexus-api --lines 100
```

## 📈 Monitoring

### Health Checks

- `/api/health` - Basic health check
- `/api/system/health` - Detailed system status

### Metrics to Monitor

- Database connection status
- Response times
- Error rates
- File upload success rate
- Data integrity issues

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:

- Create an issue in the repository
- Contact the development team
- Check the troubleshooting section above
