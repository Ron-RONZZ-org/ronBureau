# RonBureau Deployment Guide

This guide explains how to deploy RonBureau on an Ubuntu 24.04 LTS server with Nginx reverse proxy and Let's Encrypt HTTPS certificates.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Automated Deployment](#automated-deployment)
- [Manual Deployment](#manual-deployment)
- [Database Options](#database-options)
- [Post-Deployment](#post-deployment)
- [Maintenance](#maintenance)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Server Requirements

- Ubuntu 24.04 LTS server (fresh installation recommended)
- Minimum 2GB RAM
- Minimum 20GB disk space
- Root or sudo access
- A domain name pointing to your server's IP address

### Domain Setup

Before deployment, ensure your domain's DNS is configured:

```
A Record:    example.com → Your Server IP
AAAA Record: example.com → Your Server IPv6 (optional)
```

Wait for DNS propagation (can take up to 24-48 hours, but usually faster).

### Firewall Ports

Ensure these ports are open:
- Port 22 (SSH)
- Port 80 (HTTP)
- Port 443 (HTTPS)

## Automated Deployment

The automated deployment script handles everything for you.

### Step 1: Prepare Server

1. SSH into your server:
   ```bash
   ssh root@your-server-ip
   ```

2. Create a directory for the application:
   ```bash
   mkdir -p /opt/ronbureau
   cd /opt/ronbureau
   ```

3. Copy or clone the RonBureau application to the server:
   ```bash
   # Option 1: Using git (if repository is accessible)
   git clone https://github.com/Ron-RONZZ-org/ronBureau.git .
   
   # Option 2: Using rsync from local machine
   # Run this from your local machine:
   rsync -avz --exclude 'node_modules' --exclude '.git' \
     /path/to/ronbureau/ root@your-server-ip:/opt/ronbureau/
   ```

### Step 2: Run Deployment Script

1. Make the script executable (if not already):
   ```bash
   chmod +x /opt/ronbureau/deploy.sh
   ```

2. Run the deployment script:
   ```bash
   sudo /opt/ronbureau/deploy.sh
   ```

3. Follow the prompts:
   - Enter your domain name (e.g., `example.com`)
   - Enter your email for Let's Encrypt notifications
   - **Choose database option:**
     - **Option 1**: Use external database (e.g., Prisma.io, hosted PostgreSQL)
     - **Option 2**: Install and configure local PostgreSQL database
   - Enter database configuration based on your choice
   - Confirm to proceed with installation

The script will:
- ✅ Update system packages
- ✅ Install Node.js 18.x
- ✅ Install and configure PostgreSQL (if local database selected)
- ✅ Install and configure Nginx
- ✅ Create application user
- ✅ Build frontend and backend
- ✅ Setup PM2 process manager
- ✅ Install Let's Encrypt SSL certificate
- ✅ Configure firewall (UFW)
- ✅ Setup automatic security updates

### Step 3: Seed Database

After deployment, seed the database with test users:

```bash
cd /opt/ronbureau/backend
sudo -u ronbureau npm run prisma:seed
```

### Step 4: Access Application

Your application is now running at:
```
https://your-domain.com
```

## Database Options

RonBureau supports two database deployment options:

### Option 1: External Database (Recommended for Cloud Deployments)

Use a hosted PostgreSQL database service like:
- **Prisma.io Accelerate** - Managed PostgreSQL with connection pooling
- **Neon** - Serverless PostgreSQL
- **Supabase** - Open source Firebase alternative
- **Railway** - Modern cloud hosting
- **AWS RDS** - Amazon's managed database
- **Google Cloud SQL** - Google's managed database
- **Azure Database for PostgreSQL** - Microsoft's managed database

**Advantages:**
- ✅ No database installation or management needed
- ✅ Automatic backups
- ✅ Built-in scaling
- ✅ High availability
- ✅ Simplified deployment

**Setup:**

1. Create a database on your chosen provider
2. Get the connection string (DATABASE_URL)
3. Select "Use external database" during deployment
4. Paste your DATABASE_URL when prompted

**Example DATABASE_URL formats:**

```env
# Prisma.io
DATABASE_URL="postgresql://user:password@db.prisma.io:5432/database?schema=public"

# Neon
DATABASE_URL="postgresql://user:password@ep-cool-name.us-east-2.aws.neon.tech/database?sslmode=require"

# Supabase
DATABASE_URL="postgresql://postgres:password@db.supabase.co:5432/postgres"

# Railway
DATABASE_URL="postgresql://postgres:password@containers.railway.app:5432/railway"
```

### Option 2: Local PostgreSQL Database

Install and manage PostgreSQL on your server.

**Advantages:**
- ✅ Full control over database
- ✅ No external dependencies
- ✅ Lower latency
- ✅ No additional costs

**Setup:**

1. Select "Install and configure local PostgreSQL database" during deployment
2. Enter database name, username, and password
3. The script will automatically install and configure PostgreSQL

## Manual Deployment

If you prefer manual deployment or need to customize the process:

### 1. Install System Dependencies

```bash
# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt-get install -y nodejs

# Install Nginx
sudo apt-get install -y nginx

# Install PM2 globally
sudo npm install -g pm2

# Install PostgreSQL (only if using local database)
sudo apt-get install -y postgresql postgresql-contrib
```

### 2. Configure Database

#### For Local PostgreSQL:

```bash
# Create database and user
sudo -u postgres psql <<EOF
CREATE DATABASE ronbureau;
CREATE USER ronbureau WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE ronbureau TO ronbureau;
ALTER DATABASE ronbureau OWNER TO ronbureau;
EOF
```

#### For External Database:

No PostgreSQL installation needed. Just obtain your DATABASE_URL from your provider.

### 3. Setup Application

```bash
# Create application user
sudo useradd -r -s /bin/bash -d /opt/ronbureau -m ronbureau

# Copy application files to /opt/ronbureau
sudo mkdir -p /opt/ronbureau
# (Copy your files here)

# Create backend .env file
```

**For Local Database:**
```bash
sudo -u ronbureau cat > /opt/ronbureau/backend/.env <<EOF
DATABASE_URL="postgresql://ronbureau:your-password@localhost:5432/ronbureau?schema=public"
JWT_SECRET="$(openssl rand -base64 32)"
FRONTEND_URL="https://your-domain.com"
PORT=3020
EOF
```

**For External Database:**
```bash
sudo -u ronbureau cat > /opt/ronbureau/backend/.env <<EOF
DATABASE_URL="your-external-database-url"
JWT_SECRET="$(openssl rand -base64 32)"
FRONTEND_URL="https://your-domain.com"
PORT=3020
EOF
```

**Frontend .env file:**
```bash
sudo -u ronbureau cat > /opt/ronbureau/frontend/.env <<EOF
API_BASE="https://your-domain.com/api"
EOF
```

### 4. Build Applications

```bash
# Build backend
cd /opt/ronbureau/backend
sudo -u ronbureau npm install
sudo -u ronbureau npm run build
sudo -u ronbureau npm run prisma:generate
sudo -u ronbureau npm run prisma:migrate

# Build frontend
cd /opt/ronbureau/frontend
sudo -u ronbureau npm install
sudo -u ronbureau npm run build
```

### 5. Configure PM2

Create `/opt/ronbureau/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'ronbureau-backend',
      cwd: '/opt/ronbureau/backend',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3020
      }
    },
    {
      name: 'ronbureau-frontend',
      cwd: '/opt/ronbureau/frontend',
      script: '.output/server/index.mjs',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        NITRO_PORT: 3002
      }
    }
  ]
};
```

Start applications:

```bash
sudo -u ronbureau pm2 start /opt/ronbureau/ecosystem.config.js
sudo -u ronbureau pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ronbureau --hp /opt/ronbureau
```

### 6. Configure Nginx

Create `/etc/nginx/sites-available/ronbureau`:

```nginx
limit_req_zone $binary_remote_addr zone=ronbureau_limit:10m rate=10r/s;

server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Backend API
    location /api/ {
        limit_req zone=ronbureau_limit burst=20 nodelay;
        proxy_pass http://localhost:3020/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Frontend
    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/ronbureau /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Setup Let's Encrypt SSL

```bash
# Install certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com --non-interactive --agree-tos --email your-email@example.com --redirect
```

### 8. Configure Firewall

```bash
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

## Post-Deployment

### Verify Installation

1. Check PM2 processes:
   ```bash
   sudo -u ronbureau pm2 status
   ```

2. Check application logs:
   ```bash
   sudo -u ronbureau pm2 logs
   ```

3. Test the application:
   ```bash
   curl https://your-domain.com
   ```

### Seed Database

```bash
cd /opt/ronbureau/backend
sudo -u ronbureau npm run prisma:seed
```

This creates test users:

| User ID   | Password    | Type               | Status    |
|-----------|-------------|--------------------|-----------|
| admin     | password123 | Administrator      | Active    |
| owner     | password123 | Organization Owner | Active    |
| user1     | password123 | User               | Active    |
| suspended | password123 | User               | Suspended |
| expired   | password123 | User               | Expired   |

**⚠️ Important:** Change these passwords in production!

## Maintenance

### View Logs

```bash
# View all logs
sudo -u ronbureau pm2 logs

# View specific app logs
sudo -u ronbureau pm2 logs ronbureau-backend
sudo -u ronbureau pm2 logs ronbureau-frontend

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Restart Applications

```bash
# Restart all applications
sudo -u ronbureau pm2 restart all

# Restart specific app
sudo -u ronbureau pm2 restart ronbureau-backend
sudo -u ronbureau pm2 restart ronbureau-frontend
```

### Update Application

See **[UPDATE-ronBureau.md](UPDATE-ronBureau.md)** for detailed update instructions.

Quick update:
```bash
sudo /opt/ronbureau/update.sh
```

### Database Backup

**For Local PostgreSQL:**
```bash
# Create backup
sudo -u postgres pg_dump ronbureau > backup-$(date +%Y%m%d-%H%M%S).sql

# Restore from backup
sudo -u postgres psql ronbureau < backup-20240101-120000.sql
```

**For External Database:**
Backups are typically managed by your database provider. Check their documentation.

### SSL Certificate Renewal

Certbot automatically renews certificates. To test renewal:

```bash
sudo certbot renew --dry-run
```

### Monitor Resources

```bash
# PM2 monitoring
sudo -u ronbureau pm2 monit

# System resources
htop
df -h
free -h
```

## Troubleshooting

### Application Won't Start

1. Check PM2 logs:
   ```bash
   sudo -u ronbureau pm2 logs
   ```

2. Check if ports are in use:
   ```bash
   sudo netstat -tulpn | grep -E '3002|3020'
   ```

3. Verify environment variables:
   ```bash
   cat /opt/ronbureau/backend/.env
   cat /opt/ronbureau/frontend/.env
   ```

### Database Connection Errors

**For Local PostgreSQL:**

1. Check PostgreSQL status:
   ```bash
   sudo systemctl status postgresql
   ```

2. Test database connection:
   ```bash
   sudo -u postgres psql -d ronbureau -c "SELECT 1;"
   ```

**For External Database:**

1. Verify DATABASE_URL is correct
2. Check network connectivity to database host
3. Verify database credentials
4. Check firewall rules on database provider

### Nginx Errors

1. Check Nginx configuration:
   ```bash
   sudo nginx -t
   ```

2. Check Nginx logs:
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

3. Verify Nginx is running:
   ```bash
   sudo systemctl status nginx
   ```

### 502 Bad Gateway

This usually means the backend isn't running:

1. Check if backend is running:
   ```bash
   sudo -u ronbureau pm2 status
   ```

2. Check backend port:
   ```bash
   sudo netstat -tulpn | grep 3020
   ```

3. Restart backend:
   ```bash
   sudo -u ronbureau pm2 restart ronbureau-backend
   ```

### SSL Certificate Issues

1. Check certificate status:
   ```bash
   sudo certbot certificates
   ```

2. Renew certificate manually:
   ```bash
   sudo certbot renew
   ```

3. Check Nginx SSL configuration:
   ```bash
   sudo cat /etc/nginx/sites-available/ronbureau
   ```

### Permission Errors

Ensure correct ownership:

```bash
sudo chown -R ronbureau:ronbureau /opt/ronbureau
```

## Security Best Practices

1. **Change default passwords**: Update test user passwords after seeding
2. **Keep system updated**: Run `apt-get update && apt-get upgrade` regularly
3. **Monitor logs**: Regularly check application and system logs
4. **Backup regularly**: Schedule automated database backups
5. **Use strong JWT secret**: Ensure a strong random JWT_SECRET in production
6. **Limit SSH access**: Consider using SSH keys instead of passwords
7. **Enable fail2ban**: Install fail2ban to prevent brute force attacks
8. **Monitor resources**: Set up monitoring and alerts
9. **Use strong database passwords**: For both local and external databases
10. **Secure DATABASE_URL**: Keep connection strings secure and never commit them

## Configuration Reference

### Environment Variables

#### Backend (.env)

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname?schema=public
JWT_SECRET=your-secret-key
FRONTEND_URL=https://your-domain.com
PORT=3020
```

#### Frontend (.env)

```env
API_BASE=https://your-domain.com/api
GRAPHHOPPER_API_KEY=optional-key
MAPTILER_API_KEY=optional-key
```

### Port Configuration

- **Frontend**: 3002 (internal)
- **Backend**: 3020 (internal)
- **HTTP**: 80 (public)
- **HTTPS**: 443 (public)

## Support

For issues and questions:
- GitHub Issues: https://github.com/Ron-RONZZ-org/ronBureau/issues
- Documentation: See [README.md](../README.md)
- Updates: See [UPDATE-ronBureau.md](UPDATE-ronBureau.md)

## License

ISC
