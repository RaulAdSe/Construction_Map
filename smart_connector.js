const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = process.env.PORT || 8080;

// Check if running in Cloud Run
const isCloudRun = process.env.K_SERVICE ? true : false;
console.log('Running in Cloud Run:', isCloudRun);
console.log('Environment variables:', Object.keys(process.env).filter(key => !key.includes('SECRET')));

// Get connection info from environment
const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME;
const dbSocketPath = process.env.DB_SOCKET_PATH || '/cloudsql';
const dbHost = process.env.DB_HOST;
const dbPort = process.env.DB_PORT || '5432';

// Database access configuration
let connectionMethods = [];

// Method 1: VPC Connector with TCP connection
if (dbHost) {
  connectionMethods.push({
    name: 'vpc-connector',
    config: {
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'servitec_map',
      host: dbHost,
      port: dbPort,
    }
  });
}

// Method 2: Cloud SQL Auth Proxy with Unix socket
if (instanceConnectionName && dbSocketPath) {
  connectionMethods.push({
    name: 'cloud-sql-proxy',
    config: {
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'servitec_map',
      host: `${dbSocketPath}/${instanceConnectionName}`,
    }
  });
}

console.log(`Available connection methods (${connectionMethods.length}):`);
connectionMethods.forEach((method, index) => {
  console.log(`  ${index + 1}. ${method.name} - host: ${method.config.host}`);
});

// Health endpoint
app.get('/health', (req, res) => {
  console.log('Health check requested');
  
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    connectionMethods: connectionMethods.map(m => m.name),
    isCloudRun,
    env: {
      hasDbHost: !!dbHost,
      hasInstanceName: !!instanceConnectionName,
      hasSocketPath: !!dbSocketPath
    }
  });
});

// Test a specific connection method
async function testConnection(method) {
  const pool = new Pool(method.config);
  let result = { success: false, method: method.name };
  
  try {
    console.log(`Testing connection method: ${method.name}`);
    const client = await pool.connect();
    const queryResult = await client.query('SELECT NOW() as time');
    client.release();
    
    result.success = true;
    result.data = queryResult.rows[0];
    result.message = 'Connection successful';
    console.log(`Connection successful using ${method.name}:`, queryResult.rows[0]);
  } catch (err) {
    result.success = false;
    result.error = {
      message: err.message,
      detail: err.detail || 'No additional details'
    };
    console.error(`Connection failed using ${method.name}:`, err.message);
  }
  
  // End pool
  await pool.end().catch(err => console.error('Error ending pool:', err));
  return result;
}

// Database test endpoint
app.get('/db-test', async (req, res) => {
  console.log('DB test requested');
  
  if (connectionMethods.length === 0) {
    return res.status(500).json({
      status: 'error',
      message: 'No database connection methods configured',
      environment: {
        dbHost,
        dbPort,
        dbSocketPath,
        instanceConnectionName
      }
    });
  }
  
  // Test all methods and collect results
  const results = [];
  for (const method of connectionMethods) {
    results.push(await testConnection(method));
  }
  
  // Check if any method succeeded
  const anySuccess = results.some(r => r.success);
  
  if (anySuccess) {
    const successResult = results.find(r => r.success);
    res.status(200).json({
      status: 'success',
      message: `Database connection successful using ${successResult.method}`,
      data: successResult.data,
      allResults: results
    });
  } else {
    res.status(500).json({
      status: 'error',
      message: 'All database connection methods failed',
      details: results
    });
  }
});

// Debug endpoint for environment variables
app.get('/debug', (req, res) => {
  console.log('Debug endpoint requested');
  
  res.status(200).json({
    environment: {
      K_SERVICE: process.env.K_SERVICE || 'not set',
      INSTANCE_CONNECTION_NAME: instanceConnectionName || 'not set',
      DB_SOCKET_PATH: dbSocketPath || 'not set',
      DB_HOST: dbHost || 'not set',
      DB_PORT: dbPort || 'not set',
      DB_USER: process.env.DB_USER || 'not set',
      DB_NAME: process.env.DB_NAME || 'not set',
      hasPassword: !!process.env.DB_PASSWORD,
      NODE_ENV: process.env.NODE_ENV || 'not set'
    },
    connectionMethods: connectionMethods.map(m => ({
      name: m.name,
      host: m.config.host,
      database: m.config.database,
      user: m.config.user
    }))
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Routes: /health, /db-test, and /debug`);
});
