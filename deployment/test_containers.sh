#!/bin/bash

# Container Testing Script
# -----------------------
# This script builds and tests the Docker containers locally before deploying to Cloud Run.
# It validates that the containers can start, connect to the database, and respond to HTTP requests.

set -e

# Print step information
info() {
    echo -e "\n\033[1;34m==>\033[0m \033[1m$1\033[0m"
}

# Print success message
success() {
    echo -e "\033[1;32m✓\033[0m $1"
}

# Print error message
error() {
    echo -e "\033[1;31m✗\033[0m $1"
}

# Print warning message
warning() {
    echo -e "\033[1;33m!\033[0m $1"
}

# Configuration
DATABASE_CONTAINER="construction-map-testdb"
BACKEND_CONTAINER="construction-map-backend-test"
FRONTEND_CONTAINER="construction-map-frontend-test"
NETWORK_NAME="construction-map-test-network"
DATABASE_NAME="construction_map_test"
DATABASE_USER="postgres"
DATABASE_PASSWORD="postgres_test"
BACKEND_PORT=8000
FRONTEND_PORT=3000
TEST_DURATION=30 # seconds to run the test containers

# Cleanup function
cleanup() {
    info "Cleaning up test environment"
    
    # Stop and remove containers
    docker rm -f $DATABASE_CONTAINER $BACKEND_CONTAINER $FRONTEND_CONTAINER 2>/dev/null || true
    
    # Remove network
    docker network rm $NETWORK_NAME 2>/dev/null || true
    
    success "Cleanup complete"
}

# Run cleanup on script exit
trap cleanup EXIT

# Function to test if HTTP endpoint is responding
test_endpoint() {
    local url=$1
    local max_attempts=$2
    local delay=$3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f -o /dev/null "$url"; then
            success "Endpoint $url is responding"
            return 0
        else
            warning "Attempt $attempt: Endpoint $url is not responding, waiting..."
            sleep $delay
            attempt=$((attempt + 1))
        fi
    done
    
    error "Endpoint $url failed to respond after $max_attempts attempts"
    return 1
}

# Step 1: Set up test network
setup_network() {
    info "Setting up Docker network"
    
    # Create network if it doesn't exist
    if ! docker network inspect $NETWORK_NAME >/dev/null 2>&1; then
        docker network create $NETWORK_NAME
        success "Created network: $NETWORK_NAME"
    else
        success "Network already exists: $NETWORK_NAME"
    fi
}

# Step 2: Start test database container
start_database() {
    info "Starting PostgreSQL container for testing"
    
    # Start PostgreSQL container
    docker run -d \
        --name $DATABASE_CONTAINER \
        --network $NETWORK_NAME \
        -e POSTGRES_USER=$DATABASE_USER \
        -e POSTGRES_PASSWORD=$DATABASE_PASSWORD \
        -e POSTGRES_DB=$DATABASE_NAME \
        postgres:15-alpine
    
    success "Started database container: $DATABASE_CONTAINER"
    
    # Wait for PostgreSQL to be ready
    echo "Waiting for PostgreSQL to be ready..."
    sleep 3
    
    # Check if PostgreSQL is running
    if ! docker exec $DATABASE_CONTAINER pg_isready -U $DATABASE_USER -d $DATABASE_NAME; then
        error "PostgreSQL is not ready"
        exit 1
    fi
    
    success "PostgreSQL is ready"
}

# Step 3: Build and test backend container
test_backend() {
    info "Building and testing backend container"
    
    # Build backend container
    docker build -t $BACKEND_CONTAINER:latest ./backend
    success "Built backend image: $BACKEND_CONTAINER"
    
    # Run backend container
    docker run -d \
        --name $BACKEND_CONTAINER \
        --network $NETWORK_NAME \
        -p $BACKEND_PORT:8000 \
        -e POSTGRES_SERVER=$DATABASE_CONTAINER \
        -e POSTGRES_USER=$DATABASE_USER \
        -e POSTGRES_PASSWORD=$DATABASE_PASSWORD \
        -e POSTGRES_DB=$DATABASE_NAME \
        -e SECRET_KEY="test_secret_key" \
        -e UPLOAD_FOLDER="/app/uploads" \
        $BACKEND_CONTAINER:latest
    
    success "Started backend container: $BACKEND_CONTAINER"
    
    # Test if backend is responding
    if test_endpoint "http://localhost:$BACKEND_PORT/api/v1" 10 2; then
        success "Backend container test passed"
    else
        error "Backend container test failed"
        
        # Show logs to help diagnose the issue
        echo -e "\nBackend container logs:"
        docker logs $BACKEND_CONTAINER
        exit 1
    fi
}

# Step 4: Build and test frontend container
test_frontend() {
    info "Building and testing frontend container"
    
    # Build frontend container
    docker build -t $FRONTEND_CONTAINER:latest ./frontend
    success "Built frontend image: $FRONTEND_CONTAINER"
    
    # Create Nginx configuration for testing
    mkdir -p /tmp/construction-map-test/
    cat > /tmp/construction-map-test/nginx.conf << EOF
server {
    listen 80;
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://$BACKEND_CONTAINER:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
    
    # Run frontend container
    docker run -d \
        --name $FRONTEND_CONTAINER \
        --network $NETWORK_NAME \
        -p $FRONTEND_PORT:80 \
        -v /tmp/construction-map-test/nginx.conf:/etc/nginx/conf.d/default.conf \
        -e API_URL="http://$BACKEND_CONTAINER:8000" \
        $FRONTEND_CONTAINER:latest
    
    success "Started frontend container: $FRONTEND_CONTAINER"
    
    # Test if frontend is responding
    if test_endpoint "http://localhost:$FRONTEND_PORT" 10 2; then
        success "Frontend container test passed"
    else
        error "Frontend container test failed"
        
        # Show logs to help diagnose the issue
        echo -e "\nFrontend container logs:"
        docker logs $FRONTEND_CONTAINER
        exit 1
    fi
}

# Run the test containers for a specified duration
run_test_duration() {
    info "Running test containers for $TEST_DURATION seconds"
    
    echo "Backend URL: http://localhost:$BACKEND_PORT"
    echo "Frontend URL: http://localhost:$FRONTEND_PORT"
    echo "Database: $DATABASE_CONTAINER"
    
    echo "Press Ctrl+C to stop the test early..."
    
    sleep $TEST_DURATION
    
    success "Test completed successfully"
    echo "Container sizes:"
    docker image ls $BACKEND_CONTAINER:latest $FRONTEND_CONTAINER:latest --format "{{.Repository}}:{{.Tag}} - {{.Size}}"
}

# Run all steps
main() {
    info "Starting container tests"
    
    setup_network
    start_database
    test_backend
    test_frontend
    run_test_duration
    
    info "All container tests passed successfully!"
}

# Run the main function
main 