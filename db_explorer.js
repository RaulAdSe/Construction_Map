const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = process.env.PORT || 8080;

// Check if running in Cloud Run
const isCloudRun = process.env.K_SERVICE ? true : false;
console.log('Running in Cloud Run:', isCloudRun);

// Get connection info from environment
const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME;
const dbSocketPath = process.env.DB_SOCKET_PATH || '/cloudsql';

// Determine connection config based on environment
let dbConfig;
let connectionType;

if (isCloudRun && instanceConnectionName) {
  // Use Cloud SQL Auth Proxy with Unix socket when in Cloud Run
  connectionType = 'Unix Socket';
  dbConfig = {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'servitec_map',
    host: `${dbSocketPath}/${instanceConnectionName}`,
  };
} else {
  // Use TCP connection when running locally
  connectionType = 'TCP';
  dbConfig = {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'servitec_map',
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || '5432',
  };
}

// Create a new pool
const pool = new Pool(dbConfig);

console.log('Connection type:', connectionType);
console.log('Connection config:', {
  ...dbConfig,
  password: '********',
});

// Health endpoint
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    connectionType
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
      connectionType,
      connection: {
        host: dbConfig.host,
        database: dbConfig.database,
        user: dbConfig.user
      }
    });
  } catch (err) {
    console.error('Database connection error:', err);
    
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      connectionType,
      error: {
        name: err.name,
        message: err.message,
        detail: err.detail || 'No additional details'
      },
      connection: {
        host: dbConfig.host,
        database: dbConfig.database,
        user: dbConfig.user
      }
    });
  }
});

// List all tables in the database
app.get('/tables', async (req, res) => {
  console.log('Tables list requested');
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT
        table_schema,
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count
      FROM
        information_schema.tables t
      WHERE
        table_schema NOT IN ('pg_catalog', 'information_schema')
        AND table_type = 'BASE TABLE'
      ORDER BY
        table_schema, table_name
    `);
    client.release();
    
    console.log(`Found ${result.rows.length} tables`);
    
    res.status(200).json({
      status: 'success',
      message: `Found ${result.rows.length} tables`,
      tables: result.rows
    });
  } catch (err) {
    console.error('Error listing tables:', err);
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to list tables',
      error: {
        name: err.name,
        message: err.message,
        detail: err.detail || 'No additional details'
      }
    });
  }
});

// Get table schema
app.get('/tables/:tableName', async (req, res) => {
  const tableName = req.params.tableName;
  console.log(`Table schema requested for: ${tableName}`);
  
  try {
    const client = await pool.connect();
    const result = await client.query(`
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        column_default,
        is_nullable
      FROM
        information_schema.columns
      WHERE
        table_name = $1
      ORDER BY
        ordinal_position
    `, [tableName]);
    
    // Get primary key information
    const pkResult = await client.query(`
      SELECT
        c.column_name
      FROM
        information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage AS ccu USING (constraint_schema, constraint_name)
        JOIN information_schema.columns AS c ON c.table_schema = tc.constraint_schema
          AND tc.table_name = c.table_name AND ccu.column_name = c.column_name
      WHERE
        constraint_type = 'PRIMARY KEY' AND tc.table_name = $1;
    `, [tableName]);
    
    // Get first 5 rows of data
    const dataResult = await client.query(`
      SELECT * FROM "${tableName}" LIMIT 5
    `);
    
    client.release();
    
    // Get primary key columns
    const primaryKeys = pkResult.rows.map(row => row.column_name);
    
    res.status(200).json({
      status: 'success',
      tableName,
      columns: result.rows,
      primaryKeys,
      sampleData: dataResult.rows
    });
  } catch (err) {
    console.error(`Error getting schema for table ${tableName}:`, err);
    
    res.status(500).json({
      status: 'error',
      message: `Failed to get schema for table ${tableName}`,
      error: {
        name: err.name,
        message: err.message,
        detail: err.detail || 'No additional details'
      }
    });
  }
});

// Debug endpoint for environment variables
app.get('/debug', (req, res) => {
  console.log('Debug endpoint requested');
  res.status(200).json({
    environment: {
      K_SERVICE: process.env.K_SERVICE || 'not set',
      INSTANCE_CONNECTION_NAME: process.env.INSTANCE_CONNECTION_NAME || 'not set',
      DB_SOCKET_PATH: process.env.DB_SOCKET_PATH || 'not set',
      DB_USER: process.env.DB_USER || 'not set',
      DB_NAME: process.env.DB_NAME || 'not set',
      hasPassword: !!process.env.DB_PASSWORD,
      NODE_ENV: process.env.NODE_ENV || 'not set'
    },
    connectionType,
    connectionHost: dbConfig.host
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Routes:`);
  console.log(` - /health    - Health check endpoint`);
  console.log(` - /db-test   - Database connection test endpoint`);
  console.log(` - /tables    - List all tables in the database`);
  console.log(` - /tables/:tableName - Get schema for a specific table`);
  console.log(` - /debug     - Show environment variables`);
}); 