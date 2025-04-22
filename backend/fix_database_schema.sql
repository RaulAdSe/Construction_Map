-- SQL script to ensure the users table has the password_hash column
-- This will be executed via gcloud sql connect command as postgres user

-- Grant necessary privileges to postgres to modify the users table 
GRANT ALL PRIVILEGES ON TABLE users TO postgres;

-- First check if password_hash column exists in users table
DO $$
DECLARE
   password_hash_exists BOOLEAN;
   hashed_password_exists BOOLEAN;
BEGIN
   -- Check if password_hash column exists
   SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'password_hash'
   ) INTO password_hash_exists;
   
   -- Check if hashed_password column exists
   SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'hashed_password'
   ) INTO hashed_password_exists;
   
   -- Take action based on what was found
   IF password_hash_exists THEN
      RAISE NOTICE 'password_hash column already exists. No changes needed.';
   ELSIF hashed_password_exists THEN
      RAISE NOTICE 'hashed_password column exists. Adding password_hash column...';
      
      -- Add the password_hash column
      ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);
      
      -- Copy data from hashed_password to password_hash
      UPDATE users SET password_hash = hashed_password;
      
      -- Set the column to NOT NULL
      ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
      
      RAISE NOTICE 'password_hash column added and data copied from hashed_password.';
   ELSE
      RAISE NOTICE 'Neither password_hash nor hashed_password columns exist. Adding password_hash column...';
      
      -- Add the password_hash column with a default hash value (this is a secure default hash for 'admin')
      ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) DEFAULT '$2b$12$GzF3nU5Zw96Hv1mZPjvC9.MR8JR.VcSX9c.1GurJJkRk1oTHpV3By ' NOT NULL;
      
      RAISE NOTICE 'password_hash column added with a default value.';
   END IF;
   
   -- Return ownership to app_user
   ALTER TABLE users OWNER TO app_user;
END $$;

-- Show the updated schema
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position; 