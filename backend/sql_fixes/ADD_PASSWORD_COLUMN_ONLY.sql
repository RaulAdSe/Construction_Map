-- MINIMAL FIX: ADD PASSWORD_HASH COLUMN ONLY
-- This script only adds the password_hash column to the existing users table

-- Add the password_hash column if it doesn't exist already
DO $$
BEGIN
    -- First check if the column already exists
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'password_hash'
    ) THEN
        -- Add the column - this is the core fix
        ALTER TABLE users 
        ADD COLUMN password_hash VARCHAR(255) NOT NULL 
        DEFAULT '$2b$12$WyyhJ10jXz9t4Gzhe0uW4uTTn13/4d7F799XM4xReTnqgLFUVd3Vy';
        
        RAISE NOTICE 'SUCCESS: Added password_hash column to users table';
        
        -- Update admin user if it exists
        UPDATE users
        SET password_hash = '$2b$12$WyyhJ10jXz9t4Gzhe0uW4uTTn13/4d7F799XM4xReTnqgLFUVd3Vy'
        WHERE username = 'admin';
    ELSE
        RAISE NOTICE 'INFO: password_hash column already exists, no changes made';
    END IF;
END $$; 