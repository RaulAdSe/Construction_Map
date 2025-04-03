#!/bin/bash

# This script creates a simplified environment file with only essential variables
# Usage: ./simple_env.sh

SOURCE_ENV=".env.production"
DEST_ENV=".env.deploy"

# Ensure source file exists
if [ ! -f $SOURCE_ENV ]; then
    echo "Error: $SOURCE_ENV does not exist"
    exit 1
fi

# Create a new environment file with only essential variables
echo "# Generated deployment environment file" > $DEST_ENV
echo "# Created: $(date)" >> $DEST_ENV
echo "" >> $DEST_ENV

# List of essential variables (add or remove as needed)
ESSENTIAL_VARS=(
    "POSTGRES_SERVER"
    "POSTGRES_USER"
    "POSTGRES_PASSWORD"
    "POSTGRES_DB"
    "SECRET_KEY"
    "CORS_ORIGINS"
    "LOG_LEVEL"
    "DEBUG"
    "GCP_STORAGE_BUCKET"
    "GCP_PROJECT_ID"
    "DATABASE_URL"
    "DATABASE_SYNC_URL"
    "CLOUD_DB_CONNECTION_STRING"
    "ENVIRONMENT"
)

# Extract essential variables
for var in "${ESSENTIAL_VARS[@]}"; do
    # Get the line containing the variable
    line=$(grep "^$var=" $SOURCE_ENV)
    if [ ! -z "$line" ]; then
        # Add to the destination file
        echo "$line" >> $DEST_ENV
    fi
done

echo "Created simplified environment file: $DEST_ENV"
echo "Contains $(grep -c "=" $DEST_ENV) variables." 