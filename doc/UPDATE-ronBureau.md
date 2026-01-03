# RonBureau Update Guide

This guide explains how to update an existing RonBureau installation on Ubuntu 24.04 LTS.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Automated Update](#automated-update)
- [Manual Update](#manual-update)
- [Database Migrations](#database-migrations)
- [Troubleshooting](#troubleshooting)
- [Rollback](#rollback)

## Prerequisites

Before updating:

1. **Backup your database** - Always backup before any update
2. **Check disk space** - Ensure sufficient space for builds
3. **Review changelog** - Check for breaking changes
4. **Plan downtime** - Update process will briefly restart services

### Important Notes

- Updates typically take 5-10 minutes
- Application will be briefly unavailable during restart
- Database migrations are applied automatically (unless skipped)
- Backups are created automatically when using local PostgreSQL

## Automated Update

The automated update script handles everything for you.

### Quick Update

For a standard update with all options enabled:

```bash
sudo /opt/ronbureau/update.sh
```

Then follow the interactive prompts.

### Update Process

The script will:

1. ✅ Create a database backup (if using local PostgreSQL)
2. ✅ Pull latest code changes (if git repository)
3. ✅ Update npm dependencies
4. ✅ Generate Prisma client
5. ✅ Run database migrations
6. ✅ Rebuild backend and frontend
7. ✅ Restart PM2 processes

### Script Options

When running the update script, you'll be prompted for:

```
Application directory [/opt/ronbureau]: <press enter or specify custom path>
Pull latest changes from git? (y/n) [y]: y
Update dependencies (npm install)? (y/n) [y]: y
Run database migrations? (y/n) [y]: y
Proceed with update? (y/n): y
```

**Option explanations:**

- **Pull from git**: Updates code from repository (select 'n' if you're deploying files manually)
- **Update dependencies**: Runs `npm install` to update packages (select 'n' for hotfixes without dependency changes)
- **Run migrations**: Applies database schema changes (select 'n' only if you're sure there are no schema changes)

## Manual Update

If you prefer manual updates or need more control:

### Step 1: Backup Database

Always backup before updating:

```bash
# For local PostgreSQL
sudo -u postgres pg_dump ronbureau > /opt/ronbureau/backups/backup-$(date +%Y%m%d-%H%M%S).sql

# Verify backup was created
ls -lh /opt/ronbureau/backups/
```

### Step 2: Update Code

If using git:

```bash
cd /opt/ronbureau
sudo -u ronbureau git pull
```

If copying files manually:

```bash
# From your local machine:
rsync -avz --exclude 'node_modules' --exclude '.git' \
  /path/to/ronbureau/ user@server:/opt/ronbureau/
```

### Step 3: Update Backend

```bash
cd /opt/ronbureau/backend

# Update dependencies
sudo -u ronbureau npm install

# Generate Prisma client
sudo -u ronbureau npm run prisma:generate

# Run migrations
sudo -u ronbureau npm run prisma:migrate deploy

# Build backend
sudo -u ronbureau npm run build
```

### Step 4: Update Frontend

```bash
cd /opt/ronbureau/frontend

# Update dependencies
sudo -u ronbureau npm install

# Build frontend
sudo -u ronbureau npm run build
```

### Step 5: Restart Applications

```bash
# Restart both applications
sudo -u ronbureau pm2 restart all

# Verify they're running
sudo -u ronbureau pm2 status

# Check logs for any errors
sudo -u ronbureau pm2 logs --lines 50
```

## Database Migrations

### Understanding Migrations

Database migrations update your database schema to match the latest Prisma schema. They:

- Add new tables or columns
- Modify existing columns
- Remove deprecated fields
- Create or update indexes

### Running Migrations

Migrations are run automatically by the update script. To run them manually:

```bash
cd /opt/ronbureau/backend

# Production deployment (doesn't prompt)
sudo -u ronbureau npm run prisma:migrate deploy

# Or standard migration (may prompt for confirmation)
sudo -u ronbureau npm run prisma:migrate
```

### Checking Migration Status

```bash
cd /opt/ronbureau/backend
sudo -u ronbureau npx prisma migrate status
```

This shows:

- Which migrations have been applied
- Which migrations are pending
- Current database schema state

### Migration Issues

If a migration fails:

1. **Check the error message** - It usually indicates the problem
2. **Review the migration SQL** - Check `backend/prisma/migrations/`
3. **Restore from backup** if needed
4. **Contact support** with error details

## Troubleshooting

### Update Script Fails

**Check the error message and logs:**

```bash
# View PM2 logs
sudo -u ronbureau pm2 logs

# Check system logs
sudo journalctl -u pm2-ronbureau.service -n 50
```

**Common issues:**

1. **Out of disk space**
   ```bash
   df -h
   # Clean up old backups or logs if needed
   ```

2. **Permission errors**
   ```bash
   sudo chown -R ronbureau:ronbureau /opt/ronbureau
   ```

3. **Port conflicts**
   ```bash
   sudo netstat -tulpn | grep -E '3002|3020'
   # Stop conflicting processes if any
   ```

### Application Won't Start After Update

**Check PM2 status:**

```bash
sudo -u ronbureau pm2 status
sudo -u ronbureau pm2 logs --err
```

**Try restarting:**

```bash
sudo -u ronbureau pm2 restart all
```

**If backend fails:**

```bash
cd /opt/ronbureau/backend

# Check environment file
cat .env

# Test if the build succeeded
ls -la dist/

# Try running directly (for debugging)
sudo -u ronbureau node dist/main.js
```

**If frontend fails:**

```bash
cd /opt/ronbureau/frontend

# Check if build succeeded
ls -la .output/

# Try running directly
sudo -u ronbureau node .output/server/index.mjs
```

### Database Connection Errors

**Check database status:**

```bash
# For local PostgreSQL
sudo systemctl status postgresql

# Test connection
sudo -u postgres psql -d ronbureau -c "SELECT 1;"
```

**Verify DATABASE_URL:**

```bash
cat /opt/ronbureau/backend/.env | grep DATABASE_URL
```

### Migration Errors

**If migration fails, check the specific error:**

```bash
cd /opt/ronbureau/backend
sudo -u ronbureau npx prisma migrate status
sudo -u ronbureau npx prisma migrate resolve --help
```

**Common migration issues:**

1. **Migration already applied**
   ```bash
   # Mark as applied
   sudo -u ronbureau npx prisma migrate resolve --applied "migration_name"
   ```

2. **Migration failed midway**
   ```bash
   # Mark as rolled back
   sudo -u ronbureau npx prisma migrate resolve --rolled-back "migration_name"
   ```

### Build Errors

**Clear node_modules and rebuild:**

```bash
# Backend
cd /opt/ronbureau/backend
sudo -u ronbureau rm -rf node_modules package-lock.json
sudo -u ronbureau npm install
sudo -u ronbureau npm run build

# Frontend
cd /opt/ronbureau/frontend
sudo -u ronbureau rm -rf node_modules package-lock.json .nuxt .output
sudo -u ronbureau npm install
sudo -u ronbureau npm run build
```

### Performance Issues After Update

**Check resource usage:**

```bash
# PM2 monitoring
sudo -u ronbureau pm2 monit

# System resources
htop
free -h
df -h
```

**Restart with PM2:**

```bash
sudo -u ronbureau pm2 restart all
```

## Rollback

If the update causes issues, you can rollback.

### Rollback Code Changes

If using git:

```bash
cd /opt/ronbureau

# View recent commits
sudo -u ronbureau git log --oneline -10

# Rollback to previous commit
sudo -u ronbureau git reset --hard <previous-commit-hash>

# Rebuild
cd backend
sudo -u ronbureau npm install
sudo -u ronbureau npm run build
sudo -u ronbureau npm run prisma:generate

cd ../frontend
sudo -u ronbureau npm install
sudo -u ronbureau npm run build

# Restart
sudo -u ronbureau pm2 restart all
```

### Rollback Database

⚠️ **Warning**: Rolling back the database will lose any data created after the backup.

```bash
# Stop the backend first
sudo -u ronbureau pm2 stop ronbureau-backend

# Restore database
sudo -u postgres psql ronbureau < /opt/ronbureau/backups/backup-YYYYMMDD-HHMMSS.sql

# Start backend
sudo -u ronbureau pm2 start ronbureau-backend
```

### Complete Rollback

If you need to completely rollback:

1. Restore code from backup or git
2. Restore database from backup
3. Rebuild applications
4. Restart services

## Post-Update Verification

After updating, verify everything works:

### 1. Check Application Status

```bash
sudo -u ronbureau pm2 status
```

All apps should show `online` status.

### 2. Check Application Logs

```bash
sudo -u ronbureau pm2 logs --lines 50
```

Look for any errors or warnings.

### 3. Test the Application

```bash
# Test if the site responds
curl -I https://your-domain.com

# Or open in browser
```

### 4. Test API Endpoints

```bash
# Health check (if available)
curl https://your-domain.com/api/health

# Test login
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"admin","password":"password123"}'
```

### 5. Verify Database

```bash
cd /opt/ronbureau/backend
sudo -u ronbureau npx prisma studio
```

This opens Prisma Studio on http://localhost:5555 (if port forwarding is set up).

## Update Best Practices

1. **Always backup before updating** - Create database and code backups
2. **Test updates in staging first** - If you have a staging environment
3. **Read the changelog** - Check for breaking changes or new requirements
4. **Schedule during low traffic** - Update during off-peak hours
5. **Monitor after update** - Watch logs and metrics for issues
6. **Keep backups** - Maintain at least 3-5 recent database backups
7. **Document changes** - Keep notes on when you updated and any issues

## Automated Updates

For regular updates, you can create a cron job (not recommended for production without testing):

```bash
# Edit crontab
sudo crontab -e

# Add weekly update on Sunday at 2 AM (example - use with caution)
# 0 2 * * 0 /opt/ronbureau/update.sh < /opt/ronbureau/update-answers.txt >> /var/log/ronbureau-update.log 2>&1
```

⚠️ **Warning**: Automated updates without testing can break your application. Always test updates manually first.

## Update Checklist

Use this checklist for each update:

- [ ] Review changelog and release notes
- [ ] Backup database
- [ ] Backup current code (git commit or file backup)
- [ ] Check disk space (at least 2GB free)
- [ ] Run update script or manual update
- [ ] Verify applications are running (`pm2 status`)
- [ ] Check logs for errors (`pm2 logs`)
- [ ] Test application in browser
- [ ] Test key features (login, navigation, etc.)
- [ ] Monitor for 24 hours after update
- [ ] Clean up old backups (keep at least 5 recent)

## Getting Help

If you encounter issues during update:

1. **Check logs**: `sudo -u ronbureau pm2 logs`
2. **Check this guide**: Review troubleshooting section
3. **Check GitHub Issues**: https://github.com/Ron-RONZZ-org/ronBureau/issues
4. **Restore from backup**: If critical, rollback and restore
5. **Create an issue**: Provide error messages and logs

## Related Documentation

- [Deployment Guide](DEPLOY-ronBureau.md)
- [Main README](../README.md)

## Version History

Keep track of your updates:

```bash
# Create a version log
echo "$(date): Updated to version X.Y.Z" >> /opt/ronbureau/update-history.txt
```
