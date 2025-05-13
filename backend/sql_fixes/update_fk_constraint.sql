-- First update the foreign key constraint to allow NULLs
ALTER TABLE user_activities 
ALTER COLUMN user_id DROP NOT NULL;

-- Verify the change
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_activities' AND column_name = 'user_id'; 