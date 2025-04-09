const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = process.env.PORT || 8080;

// Connection information from environment
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'servitec_map',
  host: process.env.DB_HOST || '172.24.48.3',  // ← Internal IP from the SQL instance info
  port: process.env.DB_PORT || '5432',
};

// Create a new pool using the config
const pool = new Pool(dbConfig);

console.log('Connection config (without password):', {
  ...dbConfig,
  password: '********'
});

// Health endpoint
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Database test endpoint
app.get('/db-test', async (req, res) => {
  console.log('DB test requested');
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as time');
    client.release();
    
    console.log('Database query successful:', result.rows[0]);
    
    res.status(200).json({
      status: 'success',
      message: 'Database connection successful',
      data: result.rows[0],
      connection: {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user
      }
    });
  } catch (err) {
    console.error('Database connection error:', err);
    
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: {
        name: err.name,
        message: err.message,
        detail: err.detail || 'No additional details'
      },
      connection: {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user
      }
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Routes: /health and /db-test`);
}); 