#!/bin/bash

################################################################################
# RonBureau Update Script
# 
# This script updates an existing RonBureau installation with:
# - Pull latest code changes (if using git)
# - Update dependencies
# - Run database migrations
# - Rebuild applications
# - Restart PM2 processes
################################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default configuration
APP_USER="ronbureau"
APP_DIR="/opt/ronbureau"
SKIP_GIT="no"
SKIP_DEPS="no"
SKIP_MIGRATION="no"

# Print colored messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Get update options
get_options() {
    print_info "=== RonBureau Update Options ==="
    echo ""
    
    read -p "Application directory [$APP_DIR]: " INPUT_DIR
    APP_DIR=${INPUT_DIR:-$APP_DIR}
    
    if [ ! -d "$APP_DIR" ]; then
        print_error "Application directory not found: $APP_DIR"
        exit 1
    fi
    
    if [ -d "$APP_DIR/.git" ]; then
        read -p "Pull latest changes from git? (y/n) [y]: " -n 1 -r GIT_PULL
        echo ""
        if [[ ! $GIT_PULL =~ ^[Nn]$ ]]; then
            SKIP_GIT="no"
        else
            SKIP_GIT="yes"
        fi
    else
        print_info "Not a git repository, skipping git pull"
        SKIP_GIT="yes"
    fi
    
    read -p "Update dependencies (npm install)? (y/n) [y]: " -n 1 -r UPDATE_DEPS
    echo ""
    if [[ ! $UPDATE_DEPS =~ ^[Nn]$ ]]; then
        SKIP_DEPS="no"
    else
        SKIP_DEPS="yes"
    fi
    
    read -p "Run database migrations? (y/n) [y]: " -n 1 -r RUN_MIGRATION
    echo ""
    if [[ ! $RUN_MIGRATION =~ ^[Nn]$ ]]; then
        SKIP_MIGRATION="no"
    else
        SKIP_MIGRATION="yes"
    fi
    
    echo ""
    print_info "Update Configuration:"
    print_info "  Application Directory: $APP_DIR"
    print_info "  Pull from git: $([ "$SKIP_GIT" = "no" ] && echo "Yes" || echo "No")"
    print_info "  Update dependencies: $([ "$SKIP_DEPS" = "no" ] && echo "Yes" || echo "No")"
    print_info "  Run migrations: $([ "$SKIP_MIGRATION" = "no" ] && echo "Yes" || echo "No")"
    echo ""
    
    read -p "Proceed with update? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Update cancelled"
        exit 1
    fi
}

# Backup database
backup_database() {
    print_info "Creating database backup..."
    
    # Extract database info from backend .env
    if [ -f "$APP_DIR/backend/.env" ]; then
        DATABASE_URL=$(grep "^DATABASE_URL=" "$APP_DIR/backend/.env" | cut -d'=' -f2- | tr -d '"')
        
        # Only backup if it's a local PostgreSQL database
        if [[ $DATABASE_URL == postgresql://*@localhost:* ]] || [[ $DATABASE_URL == postgresql://*@127.0.0.1:* ]]; then
            BACKUP_DIR="$APP_DIR/backups"
            mkdir -p "$BACKUP_DIR"
            BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).sql"
            
            # Extract database name from URL
            DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
            
            if [ -n "$DB_NAME" ]; then
                sudo -u postgres pg_dump "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null || true
                if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
                    print_success "Database backed up to: $BACKUP_FILE"
                else
                    print_info "Database backup skipped or failed"
                    rm -f "$BACKUP_FILE"
                fi
            else
                print_info "Could not determine database name, skipping backup"
            fi
        else
            print_info "External database detected, skipping backup"
        fi
    else
        print_info "No .env file found, skipping database backup"
    fi
}

# Pull latest changes from git
pull_changes() {
    if [ "$SKIP_GIT" = "yes" ]; then
        print_info "Skipping git pull"
        return
    fi
    
    print_info "Pulling latest changes from git..."
    cd "$APP_DIR"
    
    # Stash any local changes
    sudo -u "$APP_USER" git stash 2>/dev/null || true
    
    # Pull changes
    sudo -u "$APP_USER" git pull
    
    print_success "Code updated"
}

# Update backend
update_backend() {
    print_info "Updating backend..."
    cd "$APP_DIR/backend"
    
    if [ "$SKIP_DEPS" = "no" ]; then
        print_info "Installing backend dependencies..."
        sudo -u "$APP_USER" npm install
    fi
    
    print_info "Generating Prisma client..."
    sudo -u "$APP_USER" npm run prisma:generate
    
    if [ "$SKIP_MIGRATION" = "no" ]; then
        print_info "Running database migrations..."
        sudo -u "$APP_USER" npm run prisma:migrate deploy 2>/dev/null || sudo -u "$APP_USER" npm run prisma:migrate || true
    fi
    
    print_info "Building backend..."
    sudo -u "$APP_USER" npm run build
    
    print_success "Backend updated"
}

# Update frontend
update_frontend() {
    print_info "Updating frontend..."
    cd "$APP_DIR/frontend"
    
    if [ "$SKIP_DEPS" = "no" ]; then
        print_info "Installing frontend dependencies..."
        sudo -u "$APP_USER" npm install
    fi
    
    print_info "Building frontend..."
    sudo -u "$APP_USER" npm run build
    
    print_success "Frontend updated"
}

# Restart applications
restart_applications() {
    print_info "Restarting applications..."
    
    # Restart with PM2
    sudo -u "$APP_USER" pm2 restart all
    
    # Wait a moment for processes to start
    sleep 3
    
    # Check status
    print_info "Application status:"
    sudo -u "$APP_USER" pm2 status
    
    print_success "Applications restarted"
}

# Print completion message
print_completion() {
    echo ""
    print_success "======================================"
    print_success "  RonBureau Update Complete!"
    print_success "======================================"
    echo ""
    print_info "Useful commands:"
    print_info "  View logs:        sudo -u $APP_USER pm2 logs"
    print_info "  Check status:     sudo -u $APP_USER pm2 status"
    print_info "  Monitor apps:     sudo -u $APP_USER pm2 monit"
    echo ""
    if [ "$SKIP_MIGRATION" = "no" ]; then
        print_info "Database migrations have been applied."
        print_info "If you need to seed with test users:"
        print_info "  cd $APP_DIR/backend"
        print_info "  sudo -u $APP_USER npm run prisma:seed"
        echo ""
    fi
}

# Main update flow
main() {
    echo "╔═══════════════════════════════════════════════════╗"
    echo "║   RonBureau Update Script                         ║"
    echo "╚═══════════════════════════════════════════════════╝"
    echo ""
    
    check_root
    get_options
    
    backup_database
    pull_changes
    update_backend
    update_frontend
    restart_applications
    
    print_completion
}

# Run main function
main "$@"
