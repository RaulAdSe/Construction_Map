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
    const socketPath = `${dbSocketPath}/${instanceConnectionName}`;
    
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