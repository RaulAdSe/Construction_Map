# Backend Deployment Summary

## Cloud Run Deployment

The backend service is deployed on Google Cloud Platform using Cloud Run with the following components:

### Deployment Script Operations
1. Creates/confirms Artifact Registry repository (`construction-map`)
2. Creates/confirms Cloud Storage bucket (`construction-map-storage`) 
3. Verifies IAM authentication on Cloud SQL instance (`construction-map-db`)
4. Configures Docker for cross-platform builds
5. Builds and pushes a Docker image to Artifact Registry
6. Ensures the service account has necessary IAM roles
7. Deploys the service to Cloud Run with appropriate configurations

## Database Connection

The application connects to the database using two primary methods:

### 1. IAM Authentication (Preferred)
- Uses Google Cloud SQL Python Connector with pg8000 driver
- Authenticates using the `servitec-map-service` service account
- No passwords required as it uses Google Cloud IAM for authentication
- Connection is established via a function that returns an authenticated connection

```python
def getconn():
    connector = Connector()
    conn = connector.connect(
        instance_connection_name,
        "pg8000",
        user=iam_user,
        db=db_name,
        enable_iam_auth=True,
    )
    return conn
```

### 2. Socket Connection (Fallback)
- Uses Unix socket in Cloud Run to connect to the database
- Path: `/cloudsql/{PROJECT_ID}:{REGION}:{INSTANCE_NAME}`

### Connection Pooling Configuration
- Pool size: Default 5 connections
- Max overflow: Default 10 additional connections
- Pool timeout: Default 30 seconds
- Pool recycle: Default 1800 seconds (30 minutes)

## Database Initialization

Database schema is initialized using `create_cloud_schema.py`, which:

1. Connects to Cloud SQL using IAM authentication
2. Checks which tables already exist using SQLAlchemy inspection
3. Creates all missing tables based on SQLAlchemy models
4. Logs the results of table creation operations
5. Has fallback connection methods if the primary method fails

This script runs during container startup as part of the entrypoint script.

## Database Contents

The database has several key tables:

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,  -- NOTE: This should be password_hash
    full_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

> **Important**: There is a discrepancy in the column name. Documentation shows `hashed_password` but the application code expects `password_hash`. This needs to be corrected for proper functioning.

### Other Tables
- **projects**: Contains construction projects
- **project_users**: Junction table defining user roles within projects
- **maps**: Stores map information for projects
- **events**: Records events placed on maps
- **comments**: Comments on events
- **notifications**: User notifications
- **files**: Uploaded files related to events

## Database Permissions

### IAM Authentication
- Service account `servitec-map-service` is granted the `roles/cloudsql.client` role
- Database user `app_user` created that maps to the service account
- No password management required with this approach

### Application-level Permissions
- Role-based access control through the `project_users` table
- Admin users have additional privileges via the `is_admin` flag

## IAM Authentication Setup

The system uses Google Cloud IAM authentication for database access:

1. **Enable IAM authentication on Cloud SQL**:
   ```bash
   gcloud sql instances patch construction-map-db --database-flags cloudsql.iam_authentication=on
   ```

2. **Grant Cloud SQL Client role to service account**:
   ```bash
   gcloud projects add-iam-policy-binding deep-responder-444017-h2 \
     --member="serviceAccount:servitec-map-service@deep-responder-444017-h2.iam.gserviceaccount.com" \
     --role="roles/cloudsql.client"
   ```

3. **Create database user for service account**:
   ```bash
   gcloud sql users create app_user \
     --instance=construction-map-db \
     --type=CLOUD_IAM_SERVICE_ACCOUNT \
     --cloud-iam-service-account=servitec-map-service@deep-responder-444017-h2.iam.gserviceaccount.com
   ```

## Column Name Discrepancy Fix

The system includes a special schema fix function to handle the password column name discrepancy:

### Schema Fix Function (fix_schema.py)

During application startup, the `ensure_password_hash_column` function is called to:

1. Check if the `users` table exists and create it if not
2. Check if the `password_hash` column exists in the `users` table
3. Add the `password_hash` column if it doesn't exist
4. Set up the admin user with default credentials
5. Fix database permissions for IAM authentication

```python
def ensure_password_hash_column(engine):
    # Check if column exists
    with engine.connect() as conn:
        # First, check if the users table exists
        table_exists = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'users'
            )
        """)).scalar()
        
        if not table_exists:
            # Create the users table if it doesn't exist
            conn.execute(text("""
                CREATE TABLE users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    is_admin BOOLEAN NOT NULL DEFAULT false,
                    is_active BOOLEAN NOT NULL DEFAULT true,
                    password_hash VARCHAR(255) NOT NULL
                )
            """))
            
        # Check if password_hash column exists
        column_exists = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'users' 
                AND column_name = 'password_hash'
            )
        """)).scalar()
        
        if not column_exists:
            # Add the column if it doesn't exist
            conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN password_hash VARCHAR(255) NOT NULL 
                DEFAULT '$2b$12$GzF3nU5Zw96Hv1mZPjvC9.MR8JR.VcSX9c.1GurJJkRk1oTHpV3By '
            """))
```

### Implementation Notes

- The script confirms during startup that the database schema is compatible with the application code.
- The default password hash is set to a known value for the admin user.
- If the `users` table is newly created, it uses the correct `password_hash` column name.
- If an existing table uses `hashed_password`, the script adds the expected `password_hash` column.
- This approach ensures backward compatibility and consistent operation even with schema discrepancies.

### Recommendations

To properly fix the column name discrepancy:

1. Create a dedicated migration script that:
   - Adds `password_hash` column if it doesn't exist
   - Copies data from `hashed_password` to `password_hash` if both exist
   - Updates application models to consistently use `password_hash`
   - Eventually removes the deprecated `hashed_password` column

2. Update documentation to correctly reflect the use of `password_hash` rather than `hashed_password` 