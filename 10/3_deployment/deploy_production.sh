#!/bin/bash

# Servitec Map - Production Deployment Script
# Based on the successful Cloud SQL Auth Proxy connection from April 10th
# This script deploys the full application to Cloud Run

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
echo_green() { echo -e "${GREEN}$1${NC}"; }
echo_blue() { echo -e "${BLUE}$1${NC}"; }
echo_yellow() { echo -e "${YELLOW}$1${NC}"; }
echo_red() { echo -e "${RED}$1${NC}"; }

# Banner
echo_blue "========================================"
echo_blue "  SERVITEC MAP PRODUCTION DEPLOYMENT"
echo_blue "  Using Cloud SQL Auth Proxy"
echo_blue "========================================"

# Check if Google Cloud SDK is installed
if ! command -v gcloud &> /dev/null; then
    echo_red "Error: Google Cloud SDK is not installed."
    echo_yellow "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo_red "Error: Docker is not installed."
    echo_yellow "Please install Docker first."
    exit 1
fi

# Check if user is logged in
ACCOUNT=$(gcloud config get-value account 2>/dev/null)
if [[ -z "$ACCOUNT" ]]; then
    echo_yellow "You need to log in to Google Cloud first."
    gcloud auth login
fi

# Load environment variables
if [ -f .env.production ]; then
    echo_blue "Using .env.production for deployment"
    source .env.production
elif [ -f .env ]; then
    echo_yellow "WARNING: Using .env instead of .env.production"
    source .env
else
    echo_red "ERROR: No environment file found (.env.production or .env)"
    exit 1
fi

# Configuration variables with fallbacks
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-$(gcloud config get-value project)}
REGION=${CLOUD_REGION:-"us-central1"}
BACKEND_SERVICE_NAME=${CLOUD_SERVICE_NAME:-"servitec-map-api"}
FRONTEND_SERVICE_NAME=${FRONTEND_SERVICE_NAME:-"servitec-map-frontend"}

# The Cloud SQL instance connection name (critical for Cloud SQL Auth Proxy)
CLOUD_SQL_CONNECTION_NAME=${CLOUD_SQL_INSTANCE:-"$PROJECT_ID:$REGION:map-view-servitec"}
SERVICE_ACCOUNT=${SERVICE_ACCOUNT:-"map-service-account@$PROJECT_ID.iam.gserviceaccount.com"}

# Database connection parameters for Cloud SQL Auth Proxy
DB_SOCKET_PATH="/cloudsql"
DB_NAME=${DB_NAME:-"servitec_map"}
DB_USER=${DB_USER:-"postgres"}
DB_PASSWORD=${DB_PASSWORD:-""}

# Validate required variables
if [[ -z "$DB_PASSWORD" ]]; then
    echo_red "ERROR: DB_PASSWORD environment variable is required"
    exit 1
fi

if [[ -z "$PROJECT_ID" ]]; then
    echo_red "ERROR: PROJECT_ID or GOOGLE_CLOUD_PROJECT environment variable is required"
    exit 1
fi

if [[ -z "$CLOUD_SQL_CONNECTION_NAME" ]]; then
    echo_red "ERROR: CLOUD_SQL_INSTANCE environment variable is required"
    exit 1
fi

# Display deployment configuration
echo_blue "Project ID:        $PROJECT_ID"
echo_blue "Region:            $REGION"
echo_blue "Backend Service:   $BACKEND_SERVICE_NAME"
echo_blue "Frontend Service:  $FRONTEND_SERVICE_NAME"
echo_blue "Cloud SQL:         $CLOUD_SQL_CONNECTION_NAME"
echo_blue "Service Account:   $SERVICE_ACCOUNT"
echo_blue "DB Socket Path:    $DB_SOCKET_PATH"
echo_blue "DB Name:           $DB_NAME"
echo_blue "DB User:           $DB_USER"
MASKED_PW="${DB_PASSWORD:0:2}***${DB_PASSWORD: -2}"
echo_blue "DB Password:       $MASKED_PW (${#DB_PASSWORD} chars)"
echo_blue "========================================"

# Set Google Cloud project
echo_blue "Setting Google Cloud project to $PROJECT_ID..."
gcloud config set project "$PROJECT_ID"

# Enable required APIs
echo_blue "Enabling required services..."
gcloud services enable cloudbuild.googleapis.com run.googleapis.com secretmanager.googleapis.com sqladmin.googleapis.com

# Ensure service account has required permissions
echo_blue "Checking service account permissions..."
# Create service account if it doesn't exist
if ! gcloud iam service-accounts describe "$SERVICE_ACCOUNT" &>/dev/null; then
    echo_blue "Creating service account $SERVICE_ACCOUNT..."
    gcloud iam service-accounts create "${SERVICE_ACCOUNT%%@*}" \
        --display-name="Map Service Account for Cloud Run"
fi

# Grant Cloud SQL Client role to service account
echo_blue "Granting Cloud SQL Client role to service account..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/cloudsql.client"

# Create a connection configuration file for the main application
echo_blue "Creating connection configuration file for the application..."
cat > 10/3_deployment/db-connection.js << EOF
/**
 * Database connection configuration for Servitec Map
 * Using Cloud SQL Auth Proxy with Unix sockets
 */
const { Pool } = require('pg');
const fs = require('fs');

// Function to check if we're in Cloud Run
const isCloudRun = () => !!process.env.K_SERVICE;
console.log('Running in Cloud Run environment:', isCloudRun());

// Create database connection pool
let pool = null;

// Configure database connection
function setupDatabaseConnection() {
  // Determine if we should use Cloud SQL Auth Proxy
  if (isCloudRun() && process.env.INSTANCE_CONNECTION_NAME) {
    // Cloud SQL Auth Proxy configuration (Unix socket)
    const dbSocketPath = process.env.DB_SOCKET_PATH || '/cloudsql';
    const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME;
    const socketPath = \`\${dbSocketPath}/\${instanceConnectionName}\`;
    
    console.log('Using Cloud SQL Auth Proxy with socket path:', socketPath);
    
    // Check if socket path exists
    const socketExists = fs.existsSync(socketPath);
    console.log('Socket path exists:', socketExists);
    
    // Configure pool with socket path
    const poolConfig = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      host: socketPath,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000,
    };
    
    console.log('Database Configuration:');
    console.log('- Host:', poolConfig.host);
    console.log('- Database:', poolConfig.database);
    console.log('- User:', poolConfig.user);
    console.log('- Password exists:', poolConfig.password ? 'Yes' : 'No');
    
    pool = new Pool(poolConfig);
    
    console.log('Unix socket connection pool created');
  } else {
    // Standard TCP connection for local development
    const poolConfig = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000,
    };
    
    console.log('Local Database Configuration:');
    console.log('- Host:', poolConfig.host);
    console.log('- Port:', poolConfig.port);
    console.log('- Database:', poolConfig.database);
    console.log('- User:', poolConfig.user);
    console.log('- Password exists:', poolConfig.password ? 'Yes' : 'No');
    
    pool = new Pool(poolConfig);
    
    console.log('TCP connection pool created for local development');
  }
  
  // Add error handler
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client:', err);
  });
  
  return pool;
}

// Initialize and export pool
module.exports = { 
  pool: setupDatabaseConnection(),
  setupDatabaseConnection
};
EOF

# Create a database test route for the application
echo_blue "Creating database test route for the application..."
cat > 10/3_deployment/db-test.js << EOF
/**
 * Database test route for Servitec Map
 */
const express = require('express');
const router = express.Router();
const { pool } = require('./db-connection');

// Database test endpoint
router.get('/', async (req, res) => {
  console.log('Received request to /db-test endpoint');
  let client;
  
  try {
    console.log('Attempting to connect to database...');
    client = await pool.connect();
    console.log('Successfully connected to database');
    
    const result = await client.query('SELECT NOW() as time');
    console.log('Query executed successfully:', result.rows[0]);
    
    return res.json({
      status: 'success',
      message: 'Database connection successful',
      data: {
        time: result.rows[0].time,
        environment: process.env.K_SERVICE ? 'Cloud Run' : 'Local',
        connectionType: process.env.INSTANCE_CONNECTION_NAME ? 'Cloud SQL Auth Proxy' : 'TCP',
        database: process.env.DB_NAME
      }
    });
  } catch (err) {
    console.error('Database connection error:', err);
    
    return res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: {
        name: err.name,
        message: err.message,
        detail: err.detail || 'No additional details',
        config: {
          host: process.env.K_SERVICE ? 'Unix Socket' : process.env.DB_HOST || 'localhost',
          database: process.env.DB_NAME,
          user: process.env.DB_USER
        }
      }
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

module.exports = router;
EOF

# Create a patch script to modify the main app to include the new DB connection
echo_blue "Creating patch script for the main application..."
cat > 10/3_deployment/patch-app.js << EOF
/**
 * This script patches the main application to use the Cloud SQL Auth Proxy connection
 * Run this script after deployment to update the connection
 */
const fs = require('fs');
const path = require('path');

// Target files in the actual application
const targetFiles = {
  dbConnection: path.join(__dirname, '..', '..', 'src', 'db.js'),
  dbTestRoute: path.join(__dirname, '..', '..', 'src', 'routes', 'db-test.js'),
  app: path.join(__dirname, '..', '..', 'src', 'app.js')
};

// Source files from the deployment directory
const sourceFiles = {
  dbConnection: path.join(__dirname, 'db-connection.js'),
  dbTestRoute: path.join(__dirname, 'db-test.js')
};

// Function to copy files
function copyFile(source, target) {
  console.log(\`Copying \${source} to \${target}...\`);
  try {
    const content = fs.readFileSync(source, 'utf8');
    fs.writeFileSync(target, content, 'utf8');
    console.log(\`Successfully copied \${source} to \${target}\`);
    return true;
  } catch (err) {
    console.error(\`Error copying \${source} to \${target}:\`, err);
    return false;
  }
}

// Execute the patching
console.log('Starting application patching for Cloud SQL Auth Proxy...');

// Copy the database connection file
copyFile(sourceFiles.dbConnection, targetFiles.dbConnection);

// Copy the db-test route
copyFile(sourceFiles.dbTestRoute, targetFiles.dbTestRoute);

// Ensure the route is correctly included in the app
console.log('Checking if app.js needs to be updated to include db-test route...');
try {
  const appContent = fs.readFileSync(targetFiles.app, 'utf8');
  
  // Check if the db-test route is already included
  if (!appContent.includes('/db-test')) {
    console.log('Adding db-test route to app.js...');
    
    // Add the import statement
    let updatedContent = appContent.replace(
      'const express = require(\'express\');',
      'const express = require(\'express\');\nconst dbTestRouter = require(\'./routes/db-test\');'
    );
    
    // Add the route registration
    updatedContent = updatedContent.replace(
      'app.use(express.json());',
      'app.use(express.json());\napp.use(\'/db-test\', dbTestRouter);\
' ./src/app.js
    );
    
    // Write the updated content back to the file
    fs.writeFileSync(targetFiles.app, updatedContent, 'utf8');
    console.log('Successfully updated app.js to include db-test route');
  } else {
    console.log('db-test route is already included in app.js');
  }
} catch (err) {
  console.error('Error updating app.js:', err);
}

console.log('Application patching complete.');
EOF

# Deploy Backend
echo_blue "========================================"
echo_blue "Deploying Backend API Service"
echo_blue "========================================"

# Build the Docker image locally with platform specification
echo_blue "Building backend Docker image for linux/amd64 platform..."
if [ -d "backend" ]; then
    # Use backend directory if it exists
    (
        cd backend
        # Copy the connection files to backend directory
        cp ../10/3_deployment/db-connection.js ./src/db.js
        cp ../10/3_deployment/db-test.js ./src/routes/db-test.js
        mkdir -p ./src/routes
        
        # Update app.js to include the route if needed
        if grep -q "app.use('/db-test'" ./src/app.js; then
            echo_yellow "db-test route already included in app.js"
        else
            echo_blue "Adding db-test route to app.js..."
            # Add import statement
            sed -i '' -e '/const express = require/a\
const dbTestRouter = require(\'./routes/db-test\');\
' ./src/app.js
            # Add route registration
            sed -i '' -e '/app.use(express.json())/a\
app.use(\'/db-test\', dbTestRouter);\
' ./src/app.js
        fi
        
        # Explicitly set platform to linux/amd64 for Cloud Run compatibility
        docker buildx build --platform linux/amd64 -t "gcr.io/$PROJECT_ID/$BACKEND_SERVICE_NAME" -f Dockerfile.prod --push .
        
        # Check if build was successful
        if [ $? -ne 0 ]; then
            echo_red "Docker build failed!"
            exit 1
        fi
        
        echo_blue "Backend Docker image built and pushed successfully."
        
        # Clean up copied files
        rm -f ./src/db.js.bak ./src/app.js.bak
    )
else
    # If no backend directory, use the main directory
    echo_blue "No backend directory found, using main directory..."
    
    # Copy the connection files to src directory
    mkdir -p src/routes
    cp 10/3_deployment/db-connection.js src/db.js
    cp 10/3_deployment/db-test.js src/routes/db-test.js
    
    # Update app.js to include the route if needed
    if grep -q "app.use('/db-test'" src/app.js; then
        echo_yellow "db-test route already included in app.js"
    else
        echo_blue "Adding db-test route to app.js..."
        # Add import statement
        sed -i '' -e '/const express = require/a\
const dbTestRouter = require(\'./routes/db-test\');\
' src/app.js
        # Add route registration
        sed -i '' -e '/app.use(express.json())/a\
app.use(\'/db-test\', dbTestRouter);\
' src/app.js
    fi
    
    # Explicitly set platform to linux/amd64 for Cloud Run compatibility
    docker buildx build --platform linux/amd64 -t "gcr.io/$PROJECT_ID/$BACKEND_SERVICE_NAME" -f Dockerfile.prod --push .
    
    # Check if build was successful
    if [ $? -ne 0 ]; then
        echo_red "Docker build failed!"
        exit 1
    fi
    
    echo_blue "Backend Docker image built and pushed successfully."
    
    # Clean up any backup files
    rm -f src/db.js.bak src/app.js.bak
fi

# Deploy backend to Cloud Run with Cloud SQL Auth Proxy
echo_blue "Deploying backend to Cloud Run with Cloud SQL Auth Proxy..."
gcloud run deploy "$BACKEND_SERVICE_NAME" \
    --image "gcr.io/$PROJECT_ID/$BACKEND_SERVICE_NAME" \
    --platform managed \
    --region "$REGION" \
    --memory "1Gi" \
    --cpu "1" \
    --timeout "300s" \
    --concurrency "80" \
    --min-instances "0" \
    --max-instances "5" \
    --set-env-vars="DB_SOCKET_PATH=$DB_SOCKET_PATH,INSTANCE_CONNECTION_NAME=$CLOUD_SQL_CONNECTION_NAME,DB_NAME=$DB_NAME,DB_USER=$DB_USER,DB_PASSWORD=$DB_PASSWORD,ENVIRONMENT=production,LOG_LEVEL=INFO,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,CORS_ORIGINS=*" \
    --service-account="$SERVICE_ACCOUNT" \
    --allow-unauthenticated \
    --add-cloudsql-instances="$CLOUD_SQL_CONNECTION_NAME"

# Wait for deployment to be ready
echo_blue "Waiting for backend deployment to be ready..."
sleep 15

# Test health endpoint
BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE_NAME" --region "$REGION" --format='value(status.url)')
echo_blue "Testing health endpoint: $BACKEND_URL/health"
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health")

if [ "$HEALTH_RESPONSE" -eq 200 ]; then
    echo_green "Health check successful!"
else
    echo_yellow "Health check returned HTTP $HEALTH_RESPONSE. Deployment may need more time to initialize."
fi

# Test database connection
echo_blue "Testing database connection: $BACKEND_URL/db-test"
DB_RESPONSE=$(curl -s "$BACKEND_URL/db-test")

echo_blue "Database connection test response: $DB_RESPONSE"
if [[ "$DB_RESPONSE" == *"\"status\":\"success\""* ]]; then
    echo_green "Database connection successful!"
else
    echo_yellow "Database connection test failed. You may need to check the database configuration."
    echo_yellow "View logs with: gcloud run services logs read $BACKEND_SERVICE_NAME --region=$REGION"
    
    # Display logs for diagnosis
    echo_blue "Fetching recent logs for diagnosis..."
    gcloud run services logs read $BACKEND_SERVICE_NAME --region $REGION --limit 50
fi

# Deploy Frontend (optional)
if [[ -d "frontend" ]]; then
    echo_blue "========================================"
    echo_blue "Deploying Frontend Service"
    echo_blue "========================================"
    
    # Get backend URL for frontend configuration
    BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE_NAME" --region "$REGION" --format='value(status.url)')
    
    # Create environment file for frontend
    echo_blue "Creating environment file for frontend build..."
    cat > frontend/.env.production << EOF
NEXT_PUBLIC_API_URL=$BACKEND_URL
NEXT_PUBLIC_ENVIRONMENT=production
EOF
    
    # Build frontend Docker image
    echo_blue "Building frontend Docker image for linux/amd64 platform..."
    (
        cd frontend
        
        # First build the React app
        echo_blue "Building React application..."
        npm install
        npm run build
        
        # Create a temporary nginx.conf
        echo_blue "Creating Nginx configuration..."
        cat > nginx.conf << EOF
server {
    listen 8080;
    server_name _;
    
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }
    
    # Proxy API requests to avoid CORS issues
    location /api/ {
        proxy_pass ${BACKEND_URL}/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$proxy_host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
EOF
        
        # Build the Docker image with platform specification
        echo_blue "Building frontend Docker image..."
        docker buildx build --platform linux/amd64 -t "gcr.io/$PROJECT_ID/$FRONTEND_SERVICE_NAME" -f Dockerfile.prod --push .
        
        # Check if build was successful
        if [ $? -ne 0 ]; then
            echo_red "Frontend Docker build failed!"
            exit 1
        fi
        
        echo_blue "Frontend Docker image built and pushed successfully."
        
        # Clean up temporary files
        rm -f nginx.conf
    )
    
    # Deploy frontend to Cloud Run
    echo_blue "Deploying frontend to Cloud Run..."
    gcloud run deploy "$FRONTEND_SERVICE_NAME" \
        --image "gcr.io/$PROJECT_ID/$FRONTEND_SERVICE_NAME" \
        --platform managed \
        --region "$REGION" \
        --memory "512Mi" \
        --cpu "1" \
        --concurrency "80" \
        --min-instances "0" \
        --max-instances "5" \
        --allow-unauthenticated
fi

# Get service URLs
BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE_NAME" --region "$REGION" --format='value(status.url)')
echo_green "Backend API deployment complete! Service is running at: $BACKEND_URL"
echo_green "Health Check: ${BACKEND_URL}/health"
echo_green "API Documentation: ${BACKEND_URL}/docs"
echo_green "Database Test: ${BACKEND_URL}/db-test"

if [[ -d "frontend" ]]; then
    FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE_NAME" --region "$REGION" --format='value(status.url)')
    echo_green "Frontend deployment complete! Service is running at: $FRONTEND_URL"
fi

echo_green "========================================" 
echo_green "      DEPLOYMENT COMPLETE!             "
echo_green "========================================" 
echo_yellow "View backend logs with: gcloud run services logs read $BACKEND_SERVICE_NAME --region=$REGION"
if [[ -d "frontend" ]]; then
    echo_yellow "View frontend logs with: gcloud run services logs read $FRONTEND_SERVICE_NAME --region=$REGION"
fi 