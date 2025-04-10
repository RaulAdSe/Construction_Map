# Thursday 11th April: Servitec Map API Deployment Troubleshooting

## Problem
The Servitec Map API deployment to Cloud Run was failing with database connection issues. Specifically, the `/db-test` endpoint was returning 404 errors, and when fixed, it was encountering authentication failures when trying to connect to the PostgreSQL database.

## Investigation
1. Analyzed Cloud Run logs to identify the specific errors:
   - Initially `/db-test` endpoint was not found (404)
   - After fixing the routing, encountered "password authentication failed for user postgres"

2. Examined the database connection files:
   - `src/db.js` - Standard TCP connection
   - `src/db-socket.js` - Unix socket connection for Cloud Run

3. Found that environment variables were being loaded incorrectly:
   - The deployment script was not properly sourcing `.env.production`
   - Database credentials were not being passed correctly to the Cloud Run service

## Solutions Implemented

### 1. Fixed Backend Router Path
Created a patched version of the `db-test.js` router that explicitly imports `db-socket.js` to ensure socket connections in Cloud Run.

### 2. Environment Variable Handling
- Updated the deployment script to properly source `.env.production`
- Added code to copy `.env.production` to the temporary deployment directory
- Ensured database credentials were correctly passed to the Cloud Run service

### 3. Backend Deployment Script Improvements
Created an improved deployment script with:
- Better error handling and logging
- Proper environment variable loading
- Explicit database connection testing
- Cleaner temporary file management

### 4. Frontend Deployment Improvements
Updated the frontend deployment script to:
- Properly load environment variables from `.env.production`
- Create and configure build-specific environment variables
- Add appropriate health check endpoint testing
- Configure NGINX for API proxying to avoid CORS issues
- Add better error handling and logging

## Scripts Used/Modified
1. `deploy_nodejs.sh` - Our new improved backend deployment script
2. `frontend/deploy_frontend.sh` - Updated frontend deployment script
3. `db-socket.js` - Examined but not modified
4. `routes/db-test.js` - Created a patched version for deployment

## Changes Made
1. Created a new temporary router file during backend deployment:
```javascript
// Path: temp_src/routes/db-test.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.production if it exists
const envProductionPath = path.join(process.cwd(), '.env.production');
if (fs.existsSync(envProductionPath)) {
  require('dotenv').config({ path: envProductionPath });
}

// Import db-socket directly for Cloud Run
let pool;
try {
  const db = require('../db-socket');
  pool = db.pool;
  console.log('Successfully imported db-socket pool');
} catch (error) {
  console.error('Error importing db-socket pool:', error);
  
  // Fallback error handler
  pool = {
    query: () => Promise.reject(new Error('No database connection available')),
    on: () => {}
  };
}

router.get('/', async (req, res) => {
  console.log('GET /db-test');
  
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT NOW()');
      const currentTime = result.rows[0].now;
      
      res.json({
        status: 'success',
        message: 'Database connection successful',
        data: {
          time: currentTime,
          environment: process.env.NODE_ENV === 'production' ? 'Cloud Run' : 'Local',
          connectionType: process.env.DB_SOCKET_PATH ? 'Cloud SQL Auth Proxy' : 'TCP',
          database: process.env.DB_NAME || 'unknown'
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database connection error:', error);
    
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: {
        name: error.name || 'error',
        message: error.message || 'Unknown error',
        detail: error.detail || 'No additional details',
        config: {
          host: process.env.DB_SOCKET_PATH ? 'Unix Socket' : (process.env.DB_HOST || 'unknown'),
          database: process.env.DB_NAME || 'unknown',
          user: process.env.DB_USER || 'unknown'
        }
      }
    });
  }
});

module.exports = router;
```

2. Updated backend deployment script to properly handle environment variables:
```bash
# Load environment variables
if [ -f ".env.production" ]; then 
  source .env.production
  echo "Loaded environment variables from .env.production"
elif [ -f ".env" ]; then
  source .env
  echo "Loaded environment variables from .env"
fi

# Copy environment files to deployment directory
if [ -f ".env.production" ]; then
  cp .env.production temp_src/
  echo "Copied .env.production to deployment directory"
fi
```

3. Updated frontend deployment script with improved environment handling:
```bash
# Load environment variables from .env.production
if [ -f ".env.production" ]; then
  source .env.production
  echo "Loaded environment variables from .env.production"
elif [ -f ".env" ]; then
  source .env
  echo "Loaded environment variables from .env"
fi

# Create a .env file for the build process with the appropriate API URL
echo "REACT_APP_API_URL=${BACKEND_URL}/api/v1" > .env.production.build
echo "REACT_APP_ENVIRONMENT=production" >> .env.production.build
cp .env.production.build .env.production
cp .env.production.build .env
```

4. Added NGINX configuration for frontend API proxying:
```nginx
server {
    listen 8080;
    root /usr/share/nginx/html;
    index index.html;

    # Health check endpoint
    location = /health {
        access_log off;
        return 200 'ok';
    }

    # Proxy API requests to avoid CORS issues
    location /api/v1/ {
        # Ensure the full path is passed to the backend
        proxy_pass ${BACKEND_URL}/api/v1/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $proxy_host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Increase timeouts for longer requests
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Results
Both the API and frontend have been successfully deployed to Cloud Run:

1. Backend API:
   - Successfully connects to the Cloud SQL database using Unix socket method
   - Responds correctly to health checks and database tests
   - Service URL: https://servitec-map-api-ypzdt6srya-uc.a.run.app

2. Frontend:
   - Successfully deployed with NGINX configuration
   - Properly proxies API requests to the backend
   - Responds correctly to health checks
   - Service URL: https://servitec-map-frontend-ypzdt6srya-uc.a.run.app

## Next Steps
- Add automated tests for both frontend and backend deployments
- Set up CI/CD pipeline for continuous deployment
- Add monitoring and alerting for the services
- Document the deployment process more thoroughly for future reference 