#!/bin/bash

# Script to fix permissions in Cloud SQL database

echo "===== Fixing permissions in Cloud SQL database ====="

# Set variables
PROJECT_ID="deep-responder-444017-h2"
INSTANCE_NAME="construction-map-db"
DB_NAME="construction_map"
SQL_FILE="fix_cloud_sql_permissions.sql"

# Set the project
gcloud config set project $PROJECT_ID

# Check if the SQL file exists
if [ ! -f "$SQL_FILE" ]; then
    echo "SQL file not found: $SQL_FILE"
    exit 1
fi

echo "Running SQL fix on instance $INSTANCE_NAME, database $DB_NAME, project $PROJECT_ID"

# Option 1: First try using direct connection
echo "Attempting to connect directly with gcloud sql connect..."
gcloud sql connect $INSTANCE_NAME \
    --database=$DB_NAME \
    --user=postgres \
    --quiet < $SQL_FILE

# Check result
if [ $? -eq 0 ]; then
    echo "SQL fix applied successfully via direct connection!"
    exit 0
fi

echo "Direct connection failed. Trying to upload to GCS and import..."

# Option 2: Try using temporary GCS bucket method
TIMESTAMP=$(date +%s)
BUCKET_NAME="$PROJECT_ID-sql-import-$TIMESTAMP"

# Create temporary bucket
echo "Creating temporary GCS bucket $BUCKET_NAME..."
gsutil mb -l us-central1 "gs://$BUCKET_NAME"

# Upload SQL file to GCS
echo "Uploading SQL file to GCS..."
gsutil cp $SQL_FILE "gs://$BUCKET_NAME/"

# Import SQL file from GCS
echo "Importing SQL file from GCS..."
gcloud sql import sql $INSTANCE_NAME "gs://$BUCKET_NAME/$SQL_FILE" \
    --database=$DB_NAME \
    --quiet

# Clean up temporary bucket
echo "Cleaning up temporary GCS bucket..."
gsutil rm -r "gs://$BUCKET_NAME"

echo "SQL fix has been applied. Please check the logs for any errors."
echo "===== Done =====" 