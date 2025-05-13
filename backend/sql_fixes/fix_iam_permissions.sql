-- Grant all privileges on the database to the IAM user
GRANT ALL PRIVILEGES ON DATABASE construction_map TO "servitec-map-service@deep-responder-444017-h2.iam";

-- Grant all privileges on all tables in the public schema to the IAM user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "servitec-map-service@deep-responder-444017-h2.iam";

-- Grant all privileges on all sequences in the public schema to the IAM user
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "servitec-map-service@deep-responder-444017-h2.iam";

-- Grant all privileges on the public schema to the IAM user
GRANT ALL PRIVILEGES ON SCHEMA public TO "servitec-map-service@deep-responder-444017-h2.iam";

-- Grant usage on the public schema to the IAM user
GRANT USAGE ON SCHEMA public TO "servitec-map-service@deep-responder-444017-h2.iam";

-- Set default permissions for new objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL PRIVILEGES ON TABLES TO "servitec-map-service@deep-responder-444017-h2.iam";

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL PRIVILEGES ON SEQUENCES TO "servitec-map-service@deep-responder-444017-h2.iam";

-- If specific tables exist, ensure they have permissions
GRANT ALL PRIVILEGES ON TABLE users TO "servitec-map-service@deep-responder-444017-h2.iam";
GRANT ALL PRIVILEGES ON TABLE projects TO "servitec-map-service@deep-responder-444017-h2.iam";
GRANT ALL PRIVILEGES ON TABLE maps TO "servitec-map-service@deep-responder-444017-h2.iam";
GRANT ALL PRIVILEGES ON TABLE events TO "servitec-map-service@deep-responder-444017-h2.iam";
GRANT ALL PRIVILEGES ON TABLE map_events TO "servitec-map-service@deep-responder-444017-h2.iam";
GRANT ALL PRIVILEGES ON TABLE event_comments TO "servitec-map-service@deep-responder-444017-h2.iam";
GRANT ALL PRIVILEGES ON TABLE event_history TO "servitec-map-service@deep-responder-444017-h2.iam";
GRANT ALL PRIVILEGES ON TABLE user_activity TO "servitec-map-service@deep-responder-444017-h2.iam";
GRANT ALL PRIVILEGES ON TABLE notifications TO "servitec-map-service@deep-responder-444017-h2.iam";

-- Make postgres the owner of these tables to ensure it can manage them
ALTER TABLE users OWNER TO postgres;
ALTER TABLE projects OWNER TO postgres;
ALTER TABLE maps OWNER TO postgres;
ALTER TABLE events OWNER TO postgres;
ALTER TABLE map_events OWNER TO postgres;
ALTER TABLE event_comments OWNER TO postgres;
ALTER TABLE event_history OWNER TO postgres;
ALTER TABLE user_activity OWNER TO postgres;
ALTER TABLE notifications OWNER TO postgres;

-- Grant specific ALTER permissions to the service account
GRANT ALL PRIVILEGES ON TABLE users TO postgres WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON TABLE users TO "servitec-map-service@deep-responder-444017-h2.iam";

-- Ensure postgres user can manage schema changes
ALTER ROLE postgres WITH SUPERUSER;

-- Optional: Grant specific column permissions if needed
GRANT UPDATE (password_hash) ON users TO "servitec-map-service@deep-responder-444017-h2.iam"; 