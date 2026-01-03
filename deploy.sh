#!/bin/bash

################################################################################
# RonBureau Deployment Script for Ubuntu 24.04 LTS
# 
# This script automates the deployment of RonBureau on Ubuntu server with:
# - Nginx reverse proxy
# - Let's Encrypt HTTPS certificate
# - PM2 process manager
# - PostgreSQL database
################################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default configuration
FRONTEND_PORT=3002
BACKEND_PORT=3020
APP_USER="ronbureau"
APP_DIR="/opt/ronbureau"
DOMAIN=""
EMAIL=""
USE_EXTERNAL_DB="no"
DATABASE_URL=""

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

# Get configuration from user
get_configuration() {
    print_info "=== RonBureau Deployment Configuration ==="
    echo ""
    
    read -p "Enter your domain name (e.g., example.com): " DOMAIN
    if [ -z "$DOMAIN" ]; then
        print_error "Domain name is required"
        exit 1
    fi
    
    read -p "Enter your email for Let's Encrypt: " EMAIL
    if [ -z "$EMAIL" ]; then
        print_error "Email is required for Let's Encrypt"
        exit 1
    fi
    
    echo ""
    print_info "Database Setup Options:"
    print_info "  1) Use external database (e.g., Prisma.io, hosted PostgreSQL)"
    print_info "  2) Install and configure local PostgreSQL database"
    echo ""
    read -p "Choose database option (1 or 2) [2]: " DB_OPTION
    DB_OPTION=${DB_OPTION:-2}
    
    if [ "$DB_OPTION" = "1" ]; then
        USE_EXTERNAL_DB="yes"
        echo ""
        print_info "Enter your external database connection string."
        print_info "Example: postgresql://user:password@host:5432/database?schema=public"
        read -p "DATABASE_URL: " DATABASE_URL
        if [ -z "$DATABASE_URL" ]; then
            print_error "DATABASE_URL is required for external database"
            exit 1
        fi
    else
        USE_EXTERNAL_DB="no"
        read -p "PostgreSQL database name [ronbureau]: " DB_NAME
        DB_NAME=${DB_NAME:-ronbureau}
        
        read -p "PostgreSQL username [ronbureau]: " DB_USER
        DB_USER=${DB_USER:-ronbureau}
        
        read -sp "PostgreSQL password: " DB_PASSWORD
        echo ""
        if [ -z "$DB_PASSWORD" ]; then
            print_error "Database password is required"
            exit 1
        fi
    fi
    
    read -sp "JWT Secret (leave empty to generate): " JWT_SECRET
    echo ""
    if [ -z "$JWT_SECRET" ]; then
        # Check if there's an existing .env file with JWT secret
        if [ -f "$APP_DIR/backend/.env" ]; then
            EXISTING_SECRET=$(grep "^JWT_SECRET=" "$APP_DIR/backend/.env" 2>/dev/null | cut -d'=' -f2- | tr -d '"')
            if [ -n "$EXISTING_SECRET" ]; then
                JWT_SECRET="$EXISTING_SECRET"
                print_info "Using existing JWT secret from .env file"
            else
                JWT_SECRET=$(openssl rand -base64 32)
                print_info "Generated new JWT secret"
            fi
        else
            JWT_SECRET=$(openssl rand -base64 32)
            print_info "Generated new JWT secret"
        fi
    fi
    
    echo ""
    print_info "Configuration:"
    print_info "  Domain: $DOMAIN"
    print_info "  Email: $EMAIL"
    if [ "$USE_EXTERNAL_DB" = "yes" ]; then
        print_info "  Database: External (provided DATABASE_URL)"
    else
        print_info "  Database: Local PostgreSQL ($DB_NAME)"
    fi
    print_info "  Frontend Port: $FRONTEND_PORT"
    print_info "  Backend Port: $BACKEND_PORT"
    echo ""
    
    read -p "Proceed with installation? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Installation cancelled"
        exit 1
    fi
}

# Update system packages
update_system() {
    print_info "Updating system packages..."
    apt-get update
    apt-get upgrade -y
    print_success "System updated"
}

# Install Node.js 18.x
install_nodejs() {
    print_info "Installing Node.js 18.x..."
    if command -v node &> /dev/null; then
        print_info "Node.js is already installed ($(node -v))"
    else
        # Use package manager instead of piping script to bash
        apt-get install -y ca-certificates curl gnupg
        mkdir -p /etc/apt/keyrings
        curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
        NODE_MAJOR=18
        echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
        apt-get update
        apt-get install -y nodejs
        print_success "Node.js installed ($(node -v))"
    fi
    
    # Install PM2 globally
    print_info "Installing PM2..."
    npm install -g pm2
    print_success "PM2 installed"
}

# Install PostgreSQL
install_postgresql() {
    print_info "Installing PostgreSQL..."
    apt-get install -y postgresql postgresql-contrib
    systemctl enable postgresql
    systemctl start postgresql
    print_success "PostgreSQL installed"
}

# Setup PostgreSQL database
setup_database() {
    print_info "Setting up PostgreSQL database..."
    
    # Create .pgpass file for secure password handling
    PGPASS_FILE="/tmp/.pgpass_ronbureau_$$"
    echo "localhost:5432:$DB_NAME:$DB_USER:$DB_PASSWORD" > "$PGPASS_FILE"
    chmod 600 "$PGPASS_FILE"
    
    # Create database and user
    export PGPASSFILE="$PGPASS_FILE"
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
    sudo -u postgres psql -c "ALTER DATABASE $DB_NAME OWNER TO $DB_USER;" 2>/dev/null || true
    
    # Clean up temp file
    rm -f "$PGPASS_FILE"
    unset PGPASSFILE
    
    print_success "Database configured"
}

# Install Nginx
install_nginx() {
    print_info "Installing Nginx..."
    apt-get install -y nginx
    systemctl enable nginx
    print_success "Nginx installed"
}

# Create application user
create_app_user() {
    print_info "Creating application user..."
    if id "$APP_USER" &>/dev/null; then
        print_info "User $APP_USER already exists"
    else
        useradd -r -s /bin/bash -d "$APP_DIR" -m "$APP_USER"
        print_success "User $APP_USER created"
    fi
}

# Clone or update repository
setup_application() {
    print_info "Setting up application..."
    
    # Create app directory
    mkdir -p "$APP_DIR"
    cd "$APP_DIR"
    
    # Clone repository (or copy files if already present)
    if [ ! -d "$APP_DIR/backend" ]; then
        print_info "Please ensure the application files are in $APP_DIR"
        print_info "Expected structure:"
        print_info "  $APP_DIR/backend/"
        print_info "  $APP_DIR/frontend/"
        print_error "Application files not found. Please copy them first."
        exit 1
    fi
    
    # Create backend .env file
    print_info "Creating backend environment file..."
    if [ "$USE_EXTERNAL_DB" = "yes" ]; then
        cat > "$APP_DIR/backend/.env" <<EOF
DATABASE_URL="$DATABASE_URL"
JWT_SECRET="$JWT_SECRET"
FRONTEND_URL="https://$DOMAIN"
PORT=$BACKEND_PORT
EOF
    else
        cat > "$APP_DIR/backend/.env" <<EOF
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?schema=public"
JWT_SECRET="$JWT_SECRET"
FRONTEND_URL="https://$DOMAIN"
PORT=$BACKEND_PORT
EOF
    fi
    
    # Create frontend .env file
    print_info "Creating frontend environment file..."
    cat > "$APP_DIR/frontend/.env" <<EOF
API_BASE="https://$DOMAIN/api"
GRAPHHOPPER_API_KEY=""
MAPTILER_API_KEY=""
EOF
    
    # Update Nuxt config for production
    cat > "$APP_DIR/frontend/.env.production" <<EOF
API_BASE="https://$DOMAIN/api"
EOF
    
    print_success "Environment files created"
}

# Install application dependencies and build
build_application() {
    print_info "Installing dependencies and building application..."
    
    # Backend
    print_info "Building backend..."
    cd "$APP_DIR/backend"
    npm install --production=false
    npm run build
    npm run prisma:generate
    npm run prisma:migrate
    print_success "Backend built"
    
    # Frontend
    print_info "Building frontend..."
    cd "$APP_DIR/frontend"
    npm install
    npm run build
    print_success "Frontend built"
    
    # Set permissions
    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
}

# Setup PM2 processes
setup_pm2() {
    print_info "Setting up PM2 processes..."
    
    # Create PM2 ecosystem file
    cat > "$APP_DIR/ecosystem.config.js" <<EOF
module.exports = {
  apps: [
    {
      name: 'ronbureau-backend',
      cwd: '$APP_DIR/backend',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: $BACKEND_PORT
      }
    },
    {
      name: 'ronbureau-frontend',
      cwd: '$APP_DIR/frontend',
      script: '.output/server/index.mjs',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: $FRONTEND_PORT,
        NITRO_PORT: $FRONTEND_PORT
      }
    }
  ]
};
EOF
    
    chown "$APP_USER:$APP_USER" "$APP_DIR/ecosystem.config.js"
    
    # Start applications with PM2
    sudo -u "$APP_USER" pm2 delete all 2>/dev/null || true
    sudo -u "$APP_USER" pm2 start "$APP_DIR/ecosystem.config.js"
    sudo -u "$APP_USER" pm2 save
    
    # Setup PM2 startup
    env PATH=$PATH:/usr/bin pm2 startup systemd -u "$APP_USER" --hp "$APP_DIR"
    
    print_success "PM2 configured and applications started"
}

# Configure Nginx
configure_nginx() {
    print_info "Configuring Nginx..."
    
    # Create Nginx configuration
    cat > "/etc/nginx/sites-available/ronbureau" <<EOF
# Rate limiting
limit_req_zone \$binary_remote_addr zone=ronbureau_limit:10m rate=10r/s;

server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    # Redirect to HTTPS (will be enabled after Let's Encrypt setup)
    # return 301 https://\$server_name\$request_uri;

    # Temporary location for Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Backend API
    location /api/ {
        limit_req zone=ronbureau_limit burst=20 nodelay;
        proxy_pass http://localhost:$BACKEND_PORT/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Frontend
    location / {
        proxy_pass http://localhost:$FRONTEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
    
    # Enable site
    ln -sf /etc/nginx/sites-available/ronbureau /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test Nginx configuration
    nginx -t
    systemctl reload nginx
    
    print_success "Nginx configured"
}

# Install and configure Let's Encrypt SSL
setup_ssl() {
    print_info "Setting up Let's Encrypt SSL certificate..."
    
    # Install certbot
    apt-get install -y certbot python3-certbot-nginx
    
    # Obtain certificate
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL" --redirect
    
    # Update Nginx config to enable HTTPS redirect (certbot does this automatically)
    
    print_success "SSL certificate installed"
}

# Configure firewall
setup_firewall() {
    print_info "Configuring firewall..."
    
    if command -v ufw &> /dev/null; then
        ufw --force enable
        ufw allow 22/tcp
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw status
        print_success "Firewall configured"
    else
        print_info "UFW not found, skipping firewall configuration"
    fi
}

# Setup automatic security updates
setup_auto_updates() {
    print_info "Setting up automatic security updates..."
    apt-get install -y unattended-upgrades
    dpkg-reconfigure -plow unattended-upgrades
    print_success "Automatic updates configured"
}

# Print completion message
print_completion() {
    echo ""
    print_success "======================================"
    print_success "  RonBureau Deployment Complete!"
    print_success "======================================"
    echo ""
    print_info "Your application is now running at:"
    print_info "  https://$DOMAIN"
    echo ""
    print_info "Useful commands:"
    print_info "  View logs:        sudo -u $APP_USER pm2 logs"
    print_info "  Restart apps:     sudo -u $APP_USER pm2 restart all"
    print_info "  Check status:     sudo -u $APP_USER pm2 status"
    print_info "  Monitor apps:     sudo -u $APP_USER pm2 monit"
    echo ""
    if [ "$USE_EXTERNAL_DB" = "no" ]; then
        print_info "Database connection:"
        print_info "  Host:     localhost"
        print_info "  Database: $DB_NAME"
        print_info "  User:     $DB_USER"
        echo ""
    else
        print_info "Using external database from provided DATABASE_URL"
        echo ""
    fi
    print_info "To seed the database with test users:"
    print_info "  cd $APP_DIR/backend"
    print_info "  sudo -u $APP_USER npm run prisma:seed"
    echo ""
}

# Main installation flow
main() {
    echo "╔═══════════════════════════════════════════════════╗"
    echo "║   RonBureau Deployment Script                     ║"
    echo "║   Ubuntu 24.04 LTS                                ║"
    echo "╚═══════════════════════════════════════════════════╝"
    echo ""
    
    check_root
    get_configuration
    
    update_system
    install_nodejs
    
    # Only install and setup PostgreSQL if using local database
    if [ "$USE_EXTERNAL_DB" = "no" ]; then
        install_postgresql
        setup_database
    else
        print_info "Skipping PostgreSQL installation (using external database)"
    fi
    
    install_nginx
    create_app_user
    setup_application
    build_application
    setup_pm2
    configure_nginx
    setup_ssl
    setup_firewall
    setup_auto_updates
    
    print_completion
}

# Run main function
main "$@"
