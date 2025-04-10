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

### 1. Fixed Router Path
Created a patched version of the `db-test.js` router that explicitly imports `db-socket.js` to ensure socket connections in Cloud Run.

### 2. Environment Variable Handling
- Updated the deployment script to properly source `.env.production`
- Added code to copy `.env.production` to the temporary deployment directory
- Ensured database credentials were correctly passed to the Cloud Run service

### 3. Deployment Script Improvements
Created an improved deployment script with:
- Better error handling and logging
- Proper environment variable loading
- Explicit database connection testing
- Cleaner temporary file management

## Scripts Used/Modified
1. `deploy_nodejs.sh` - Our new improved deployment script
2. `db-socket.js` - Examined but not modified
3. `routes/db-test.js` - Created a patched version for deployment

## Changes Made
1. Created a new temporary router file during deployment:
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

2. Updated deployment script to properly handle environment variables and deployment:
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

## Results
The API now successfully connects to the Cloud SQL database using the Unix socket method through the Cloud SQL Auth Proxy. The `/db-test` endpoint returns a successful response confirming the database connection is working.

Service URL: https://servitec-map-api-ypzdt6srya-uc.a.run.app

## Next Steps
- Deploy the frontend application to connect with the now-functional backend API
- Verify end-to-end functionality
- Document the complete deployment process for future reference 