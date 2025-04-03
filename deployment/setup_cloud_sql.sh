#!/bin/bash

# Script to create a Cloud SQL instance with flexible connection options
# This allows connections from any IP address (0.0.0.0/0)

set -e

# Configuration
PROJECT_ID="${PROJECT_ID:-your-project-id}"
INSTANCE_NAME="${INSTANCE_NAME:-construction-map-db}"
REGION="${REGION:-us-central1}"
DB_VERSION="${DB_VERSION:-POSTGRES_15}"
TIER="${TIER:-db-g1-small}"
DB_NAME="${DB_NAME:-construction_map}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 12)}"
ROOT_PASSWORD="${ROOT_PASSWORD:-$(openssl rand -base64 16)}"

# Function to show help
function show_help {
    echo "Cloud SQL Setup Script"
    echo "---------------------"
    echo "Creates a Cloud SQL PostgreSQL instance that allows connections from any IP."
    echo ""
    echo "Usage:"
    echo "  $0 [command]"
    echo ""
    echo "Commands:"
    echo "  create     - Create the Cloud SQL instance"
    echo "  authorize  - Authorize all IPs to connect to the instance"
    echo "  help       - Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  PROJECT_ID, INSTANCE_NAME, REGION, DB_VERSION, TIER"
    echo "  DB_NAME, DB_USER, DB_PASSWORD, ROOT_PASSWORD"
    echo ""
    echo "Example:"
    echo "  PROJECT_ID=my-project INSTANCE_NAME=my-db $0 create"
}

# Function to create the Cloud SQL instance
function create_instance {
    echo "Creating Cloud SQL instance: $INSTANCE_NAME"
    echo "Project ID: $PROJECT_ID"
    echo "Region: $REGION"
    
    # First, make sure you're using the right project
    gcloud config set project "$PROJECT_ID"
    
    # Create the Cloud SQL instance
    gcloud sql instances create "$INSTANCE_NAME" \
        --database-version="$DB_VERSION" \
        --tier="$TIER" \
        --region="$REGION" \
        --root-password="$ROOT_PASSWORD" \
        --availability-type=zonal \
        --storage-size=10GB \
        --storage-auto-increase
    
    # Create database
    gcloud sql databases create "$DB_NAME" \
        --instance="$INSTANCE_NAME"
    
    # Create user
    gcloud sql users create "$DB_USER" \
        --instance="$INSTANCE_NAME" \
        --password="$DB_PASSWORD"
    
    # Authorize all IPs (0.0.0.0/0) to connect
    gcloud sql instances patch "$INSTANCE_NAME" \
        --authorized-networks=0.0.0.0/0
    
    # Get connection details
    INSTANCE_IP=$(gcloud sql instances describe "$INSTANCE_NAME" --format='value(ipAddresses[0].ipAddress)')
    INSTANCE_CONNECTION_NAME=$(gcloud sql instances describe "$INSTANCE_NAME" --format='value(connectionName)')
    
    echo ""
    echo "Cloud SQL instance created successfully!"
    echo "-----------------------------------------"
    echo "Instance name: $INSTANCE_NAME"
    echo "Public IP address: $INSTANCE_IP"
    echo "Connection name for Cloud SQL Proxy: $INSTANCE_CONNECTION_NAME"
    echo ""
    echo "Database name: $DB_NAME"
    echo "Username: $DB_USER"
    echo "Password: $DB_PASSWORD"
    echo ""
    echo "Connection string for PostgreSQL:"
    echo "postgres://$DB_USER:$DB_PASSWORD@$INSTANCE_IP:5432/$DB_NAME"
    echo ""
    echo "Using Cloud SQL Proxy (more secure option):"
    echo "1. Download Cloud SQL Proxy: https://cloud.google.com/sql/docs/postgres/connect-admin-proxy"
    echo "2. Run: ./cloud_sql_proxy -instances=$INSTANCE_CONNECTION_NAME=tcp:5432"
    echo "3. Connect to: postgres://$DB_USER:$DB_PASSWORD@127.0.0.1:5432/$DB_NAME"
}

# Function to authorize all IPs for an existing instance
function authorize_all_ips {
    echo "Authorizing all IPs (0.0.0.0/0) to connect to: $INSTANCE_NAME"
    
    # Authorize all IPs
    gcloud sql instances patch "$INSTANCE_NAME" \
        --authorized-networks=0.0.0.0/0
    
    echo "Authorization complete. The database now accepts connections from any IP address."
}

# Main function
case "$1" in
    create)
        create_instance
        ;;
    authorize)
        authorize_all_ips
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Error: Unknown command"
        show_help
        exit 1
        ;;
esac

echo ""
echo "⚠️ SECURITY WARNING ⚠️"
echo "Allowing connections from any IP (0.0.0.0/0) is convenient for development"
echo "but not recommended for production. Consider using Cloud SQL Proxy,"
echo "Private IP, or limiting authorized networks for production deployments." 