-- IMPORTANT: Run this script as the postgres superuser

-- First make postgres the owner of the users table
ALTER TABLE users OWNER TO postgres;

-- Then grant all permissions to the service account
GRANT ALL PRIVILEGES ON TABLE users TO "servitec-map-service@deep-responder-444017-h2.iam";

-- Grant specific privileges on the sequences associated with the users table
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "servitec-map-service@deep-responder-444017-h2.iam";

-- Re-grant permissions on the schema
GRANT USAGE ON SCHEMA public TO "servitec-map-service@deep-responder-444017-h2.iam";

-- Ensure all future objects get the same permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON TABLES TO "servitec-map-service@deep-responder-444017-h2.iam";

-- If you need to change columns in the users table (like adding password_hash)
-- this will ensure you have permission
GRANT ALL PRIVILEGES ON TABLE users TO postgres WITH GRANT OPTION; 