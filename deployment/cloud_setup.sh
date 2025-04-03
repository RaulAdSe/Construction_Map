#!/bin/bash

# Cloud Deployment Setup Script
# This script helps set up cloud resources for the Construction Map application

# Exit on error
set -e

# Configuration
CLOUD_PROVIDER="${CLOUD_PROVIDER:-aws}"  # aws, azure, gcp
ENVIRONMENT="${ENVIRONMENT:-development}"
PROJECT_NAME="${PROJECT_NAME:-construction-map}"
REGION="${REGION:-us-west-2}"
DB_INSTANCE_TYPE="${DB_INSTANCE_TYPE:-db.t3.medium}"
VM_INSTANCE_TYPE="${VM_INSTANCE_TYPE:-t3.medium}"
STORAGE_BUCKET="${STORAGE_BUCKET:-$PROJECT_NAME-$ENVIRONMENT-storage}"

# Functions
function show_help {
    echo "Cloud Deployment Setup Script"
    echo "-----------------------------"
    echo "Usage:"
    echo "  $0 [command]"
    echo ""
    echo "Commands:"
    echo "  setup-aws     - Set up AWS resources"
    echo "  setup-azure   - Set up Azure resources"
    echo "  setup-gcp     - Set up GCP resources"
    echo "  help          - Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  CLOUD_PROVIDER, ENVIRONMENT, PROJECT_NAME, REGION"
    echo "  DB_INSTANCE_TYPE, VM_INSTANCE_TYPE, STORAGE_BUCKET"
    echo ""
    echo "Example:"
    echo "  ENVIRONMENT=production REGION=us-east-1 $0 setup-aws"
}

function setup_aws {
    echo "Setting up AWS resources for $PROJECT_NAME in $REGION ($ENVIRONMENT)"
    
    # Create S3 bucket for static assets
    echo "Creating S3 bucket: $STORAGE_BUCKET"
    aws s3api create-bucket \
        --bucket "$STORAGE_BUCKET" \
        --region "$REGION" \
        --create-bucket-configuration LocationConstraint="$REGION"
    
    # Enable CORS on S3 bucket
    aws s3api put-bucket-cors \
        --bucket "$STORAGE_BUCKET" \
        --cors-configuration '{
            "CORSRules": [
                {
                    "AllowedHeaders": ["*"],
                    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
                    "AllowedOrigins": ["*"],
                    "ExposeHeaders": ["ETag"]
                }
            ]
        }'
    
    # Create RDS PostgreSQL instance
    echo "Creating RDS PostgreSQL instance: $PROJECT_NAME-$ENVIRONMENT-db"
    aws rds create-db-instance \
        --db-instance-identifier "$PROJECT_NAME-$ENVIRONMENT-db" \
        --db-instance-class "$DB_INSTANCE_TYPE" \
        --engine postgres \
        --engine-version 15.3 \
        --allocated-storage 20 \
        --master-username postgres \
        --master-user-password "$(openssl rand -base64 16)" \
        --db-name "${PROJECT_NAME//-/_}" \
        --backup-retention-period 7 \
        --multi-az \
        --storage-type gp2 \
        --region "$REGION"
    
    # Create EC2 instance
    echo "Creating EC2 instance: $PROJECT_NAME-$ENVIRONMENT-app"
    # This is a simplified version - typically you'd use CloudFormation or Terraform
    aws ec2 run-instances \
        --image-id ami-0c55b159cbfafe1f0 \
        --instance-type "$VM_INSTANCE_TYPE" \
        --key-name "$PROJECT_NAME-$ENVIRONMENT-key" \
        --security-group-ids sg-12345678 \
        --subnet-id subnet-12345678 \
        --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$PROJECT_NAME-$ENVIRONMENT-app}]" \
        --region "$REGION"
    
    echo "AWS resources setup completed"
}

function setup_azure {
    echo "Setting up Azure resources for $PROJECT_NAME in $REGION ($ENVIRONMENT)"
    
    # Create resource group
    echo "Creating resource group: $PROJECT_NAME-$ENVIRONMENT-rg"
    az group create \
        --name "$PROJECT_NAME-$ENVIRONMENT-rg" \
        --location "$REGION"
    
    # Create storage account
    echo "Creating storage account: ${PROJECT_NAME//-/}${ENVIRONMENT}sa"
    az storage account create \
        --name "${PROJECT_NAME//-/}${ENVIRONMENT}sa" \
        --resource-group "$PROJECT_NAME-$ENVIRONMENT-rg" \
        --location "$REGION" \
        --sku Standard_LRS \
        --kind StorageV2
    
    # Create container for blob storage
    echo "Creating blob container: $STORAGE_BUCKET"
    az storage container create \
        --name "$STORAGE_BUCKET" \
        --account-name "${PROJECT_NAME//-/}${ENVIRONMENT}sa" \
        --public-access blob
    
    # Create PostgreSQL server
    echo "Creating PostgreSQL server: $PROJECT_NAME-$ENVIRONMENT-db"
    az postgres server create \
        --name "$PROJECT_NAME-$ENVIRONMENT-db" \
        --resource-group "$PROJECT_NAME-$ENVIRONMENT-rg" \
        --location "$REGION" \
        --admin-user postgres \
        --admin-password "$(openssl rand -base64 16)" \
        --sku-name GP_Gen5_2 \
        --version 14
    
    # Create VM
    echo "Creating VM: $PROJECT_NAME-$ENVIRONMENT-vm"
    az vm create \
        --resource-group "$PROJECT_NAME-$ENVIRONMENT-rg" \
        --name "$PROJECT_NAME-$ENVIRONMENT-vm" \
        --image UbuntuLTS \
        --admin-username azureuser \
        --generate-ssh-keys \
        --size Standard_B2s
    
    echo "Azure resources setup completed"
}

function setup_gcp {
    echo "Setting up GCP resources for $PROJECT_NAME in $REGION ($ENVIRONMENT)"
    
    # Create GCS bucket
    echo "Creating GCS bucket: $STORAGE_BUCKET"
    gsutil mb -l "$REGION" "gs://$STORAGE_BUCKET"
    
    # Set CORS configuration
    cat > /tmp/cors.json << EOL
[
    {
        "origin": ["*"],
        "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"],
        "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
        "maxAgeSeconds": 3600
    }
]
EOL
    gsutil cors set /tmp/cors.json "gs://$STORAGE_BUCKET"
    
    # Create Cloud SQL instance
    echo "Creating Cloud SQL instance: $PROJECT_NAME-$ENVIRONMENT-db"
    gcloud sql instances create "$PROJECT_NAME-$ENVIRONMENT-db" \
        --database-version=POSTGRES_15 \
        --cpu=1 \
        --memory=3840MiB \
        --region="$REGION" \
        --root-password="$(openssl rand -base64 16)"
    
    # Create database
    echo "Creating database: ${PROJECT_NAME//-/_}"
    gcloud sql databases create "${PROJECT_NAME//-/_}" \
        --instance="$PROJECT_NAME-$ENVIRONMENT-db"
    
    # Create VM instance
    echo "Creating VM instance: $PROJECT_NAME-$ENVIRONMENT-vm"
    gcloud compute instances create "$PROJECT_NAME-$ENVIRONMENT-vm" \
        --zone="${REGION}-a" \
        --machine-type=e2-medium \
        --image-family=ubuntu-2004-lts \
        --image-project=ubuntu-os-cloud \
        --boot-disk-size=10GB \
        --tags=http-server,https-server
    
    echo "GCP resources setup completed"
}

# Main
case "$1" in
    setup-aws)
        setup_aws
        ;;
    setup-azure)
        setup_azure
        ;;
    setup-gcp)
        setup_gcp
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