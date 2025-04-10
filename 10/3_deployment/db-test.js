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