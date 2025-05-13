-- IMPORTANT: Run this script manually as the postgres superuser
-- from the Cloud SQL Editor or using psql with superuser privileges

-- Check if password_hash column exists and add it if not
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN password_hash VARCHAR(255) NOT NULL
        DEFAULT '$2b$12$GzF3nU5Zw96Hv1mZPjvC9.MR8JR.VcSX9c.1GurJJkRk1oTHpV3By ';
    END IF;
END $$;

-- Set proper ownership of tables (needed for table alterations)
ALTER TABLE users OWNER TO postgres;
ALTER TABLE projects OWNER TO postgres;
ALTER TABLE maps OWNER TO postgres;
ALTER TABLE events OWNER TO postgres;
ALTER TABLE map_events OWNER TO postgres;
ALTER TABLE event_comments OWNER TO postgres;
ALTER TABLE event_history OWNER TO postgres;
ALTER TABLE user_activity OWNER TO postgres;
ALTER TABLE notifications OWNER TO postgres;

-- Grant complete permissions to service account
GRANT ALL PRIVILEGES ON DATABASE construction_map TO "servitec-map-service@deep-responder-444017-h2.iam";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "servitec-map-service@deep-responder-444017-h2.iam";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "servitec-map-service@deep-responder-444017-h2.iam";
GRANT ALL PRIVILEGES ON SCHEMA public TO "servitec-map-service@deep-responder-444017-h2.iam";

-- For future tables/objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON TABLES TO "servitec-map-service@deep-responder-444017-h2.iam";

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT ALL PRIVILEGES ON SEQUENCES TO "servitec-map-service@deep-responder-444017-h2.iam";

-- Print success message
DO $$
BEGIN
    RAISE NOTICE 'Database patches applied successfully';
END $$; 