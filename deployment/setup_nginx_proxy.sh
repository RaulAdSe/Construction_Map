#!/bin/bash

# Script to set up an Nginx reverse proxy for Cloud Run services
# This is meant to be run on a GCP Compute Engine VM

set -e

# Configuration
DOMAIN="${DOMAIN:-your-domain.com}"
FRONTEND_URL="${FRONTEND_URL:-https://frontend-url.run.app}"
BACKEND_URL="${BACKEND_URL:-https://backend-url.run.app}"
EMAIL="${EMAIL:-your-email@example.com}"

# Function to show help
show_help() {
    echo "Nginx Reverse Proxy Setup Script"
    echo "-------------------------------"
    echo "Sets up an Nginx reverse proxy to Cloud Run services with SSL"
    echo ""
    echo "Usage:"
    echo "  $0 [command]"
    echo ""
    echo "Commands:"
    echo "  install    - Install Nginx and dependencies"
    echo "  configure  - Configure Nginx as a reverse proxy"
    echo "  ssl        - Set up SSL with Let's Encrypt"
    echo "  all        - Run all steps (install, configure, ssl)"
    echo "  help       - Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  DOMAIN, FRONTEND_URL, BACKEND_URL, EMAIL"
    echo ""
    echo "Example:"
    echo "  DOMAIN=example.com FRONTEND_URL=https://my-frontend.run.app $0 all"
}

# Function to install Nginx and dependencies
install_nginx() {
    echo "Installing Nginx and dependencies..."
    
    # Update package lists
    sudo apt-get update
    
    # Install Nginx
    sudo apt-get install -y nginx
    
    # Install Certbot for Let's Encrypt
    sudo apt-get install -y certbot python3-certbot-nginx
    
    # Enable and start Nginx service
    sudo systemctl enable nginx
    sudo systemctl start nginx
    
    echo "Nginx installation completed"
}

# Function to configure Nginx as a reverse proxy
configure_nginx() {
    echo "Configuring Nginx as a reverse proxy for: $DOMAIN"
    
    # Create Nginx configuration
    CONFIG_PATH="/etc/nginx/sites-available/$DOMAIN"
    
    # Replace placeholders in the configuration template
    sudo tee "$CONFIG_PATH" > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # Redirect HTTP to HTTPS (will be configured by Certbot)
    location / {
        proxy_pass $FRONTEND_URL;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass \$http_upgrade;
    }
    
    # Backend API proxy
    location /api/ {
        proxy_pass $BACKEND_URL;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Handle CORS preflight requests
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE';
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
        
        # For non-OPTIONS requests
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
    }
}
EOF
    
    # Enable the site
    sudo ln -sf "$CONFIG_PATH" /etc/nginx/sites-enabled/
    
    # Test Nginx configuration
    sudo nginx -t
    
    # Reload Nginx to apply changes
    sudo systemctl reload nginx
    
    echo "Nginx configuration completed"
}

# Function to set up SSL with Let's Encrypt
setup_ssl() {
    echo "Setting up SSL with Let's Encrypt for: $DOMAIN"
    
    # Run Certbot to obtain SSL certificates and configure Nginx
    sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL" --redirect
    
    # Add a cron job to automatically renew the certificate
    (crontab -l 2>/dev/null; echo "0 3 * * * sudo certbot renew --quiet") | crontab -
    
    echo "SSL configuration completed"
    echo "Certificates will automatically renew when needed"
}

# Main function
case "$1" in
    install)
        install_nginx
        ;;
    configure)
        configure_nginx
        ;;
    ssl)
        setup_ssl
        ;;
    all)
        install_nginx
        configure_nginx
        setup_ssl
        
        echo ""
        echo "Nginx reverse proxy setup completed!"
        echo "-----------------------------------"
        echo "Domain: $DOMAIN"
        echo "Frontend service: $FRONTEND_URL"
        echo "Backend service: $BACKEND_URL"
        echo ""
        echo "Your website should now be accessible at: https://$DOMAIN"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Error: Unknown command"
        show_help
        exit 1
        ;;
esac 