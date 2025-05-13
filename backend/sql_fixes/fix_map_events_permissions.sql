-- Connect as postgres superuser first

-- Set ownership of the map_events table to postgres
ALTER TABLE map_events OWNER TO postgres;

-- Grant permissions to IAM user
GRANT ALL PRIVILEGES ON TABLE map_events TO "servitec-map-service@deep-responder-444017-h2.iam";

-- Check if there's a specific sequence for map_events 
GRANT ALL PRIVILEGES ON SEQUENCE map_events_id_seq TO "servitec-map-service@deep-responder-444017-h2.iam";

-- Ensure the IAM user can see the schema
GRANT USAGE ON SCHEMA public TO "servitec-map-service@deep-responder-444017-h2.iam";

-- For rows in the map_events table
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE map_events TO "servitec-map-service@deep-responder-444017-h2.iam"; 