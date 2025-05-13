# Cloud SQL Database Fix Instructions

## Problem
The application is failing with the error: `column users.password_hash does not exist`. This indicates that the database schema is missing the `password_hash` column that the application code expects.

## Solution
You can fix this issue by adding the missing column to the database table. Here are two ways to do it:

## Option 1: Using Google Cloud Console (Preferred)

1. Log in to your Google Cloud Console
2. Navigate to SQL > construction-map-db instance
3. Click on "Databases" in the left sidebar
4. Select the "construction_map" database
5. Click on "Query editor"
6. Copy and paste the contents of the `fix_password_hash.sql` file
7. Click "Run"
8. Verify that the query executed successfully
9. Restart your Cloud Run instance

## Option 2: Using Cloud SQL Proxy

If you have properly configured Google Cloud authentication:

1. Start the Cloud SQL Proxy:
   ```bash
   ./cloud_sql_proxy deep-responder-444017-h2:us-central1:construction-map-db --port 5432
   ```

2. In a new terminal, run:
   ```bash
   PGPASSWORD=YOUR_POSTGRES_PASSWORD psql -h localhost -p 5432 -U postgres -d construction_map -f fix_password_hash.sql
   ```

3. Restart your Cloud Run instance

## Option 3: Direct SQL Commands

If you have direct access to the database through a tool like pgAdmin or psql, you can run:

```sql
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL 
DEFAULT '$2b$12$WyyhJ10jXz9t4Gzhe0uW4uTTn13/4d7F799XM4xReTnqgLFUVd3Vy';

UPDATE users
SET password_hash = '$2b$12$WyyhJ10jXz9t4Gzhe0uW4uTTn13/4d7F799XM4xReTnqgLFUVd3Vy'
WHERE username = 'admin';
```

## After Fixing

After applying any of these solutions:

1. The database will have the `password_hash` column
2. The admin user will have the password set to `admin123`
3. Your application should now be able to authenticate users properly

## Verifying the Fix

To verify the fix was successful:

1. Try logging in with username `admin` and password `admin123`
2. Check the Cloud Run logs - you should no longer see the "column users.password_hash does not exist" error 