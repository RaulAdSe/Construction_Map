#!/bin/bash

# Script to deploy the Construction Map application to Google Cloud Run

set -e

# Configuration
PROJECT_ID="${PROJECT_ID:-your-project-id}"
REGION="${REGION:-us-central1}"
BACKEND_SERVICE_NAME="${BACKEND_SERVICE_NAME:-construction-map-backend}"
FRONTEND_SERVICE_NAME="${FRONTEND_SERVICE_NAME:-construction-map-frontend}"
DB_INSTANCE_NAME="${DB_INSTANCE_NAME:-construction-map-db}"
DB_NAME="${DB_NAME:-construction_map}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"
STORAGE_BUCKET="${STORAGE_BUCKET:-${PROJECT_ID}-construction-map-storage}"
GCR_HOSTNAME="gcr.io"  # or "us.gcr.io", "eu.gcr.io", "asia.gcr.io"

# Function to show help
function show_help {
    echo "Cloud Run Deployment Script"
    echo "--------------------------"
    echo "Deploys the Construction Map application to Google Cloud Run"
    echo ""
    echo "Usage:"
    echo "  $0 [command]"
    echo ""
    echo "Commands:"
    echo "  setup       - Setup Google Cloud project resources"
    echo "  build       - Build and push Docker images"
    echo "  deploy      - Deploy services to Cloud Run"
    echo "  all         - Run all steps (setup, build, deploy)"
    echo "  help        - Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  PROJECT_ID, REGION, BACKEND_SERVICE_NAME, FRONTEND_SERVICE_NAME"
    echo "  DB_INSTANCE_NAME, DB_NAME, DB_USER, DB_PASSWORD, STORAGE_BUCKET"
    echo ""
    echo "Example:"
    echo "  PROJECT_ID=my-project REGION=us-west1 $0 all"
}

# Function to set up required Google Cloud resources
function setup_cloud_resources {
    echo "Setting up Google Cloud resources for project: $PROJECT_ID"
    
    # Set the project
    gcloud config set project "$PROJECT_ID"
    
    # Enable required APIs
    echo "Enabling required Google Cloud APIs..."
    gcloud services enable cloudbuild.googleapis.com
    gcloud services enable run.googleapis.com
    gcloud services enable sqladmin.googleapis.com
    gcloud services enable storage-api.googleapis.com
    gcloud services enable secretmanager.googleapis.com
    
    # Create Cloud Storage bucket for uploads
    echo "Creating Cloud Storage bucket: $STORAGE_BUCKET"
    gsutil mb -l "$REGION" "gs://$STORAGE_BUCKET" || true
    
    # Set CORS policy for the bucket
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
    
    # Create secrets for database credentials
    if [ -n "$DB_PASSWORD" ]; then
        echo "Creating secrets for database credentials..."
        echo -n "$DB_PASSWORD" | gcloud secrets create construction-map-db-password \
            --data-file=- \
            --replication-policy="automatic"
        
        # Grant the Cloud Run service account access to the secret
        gcloud secrets add-iam-policy-binding construction-map-db-password \
            --member="serviceAccount:${PROJECT_ID}@appspot.gserviceaccount.com" \
            --role="roles/secretmanager.secretAccessor"
    fi
    
    echo "Google Cloud resources setup complete"
}

# Function to build and push Docker images
function build_and_push_images {
    echo "Building and pushing Docker images to Google Container Registry"
    
    # Set project
    gcloud config set project "$PROJECT_ID"
    
    # Configure Docker to use gcloud as credential helper
    gcloud auth configure-docker
    
    # Backend
    echo "Building backend image..."
    cd backend
    docker build -t "$GCR_HOSTNAME/$PROJECT_ID/$BACKEND_SERVICE_NAME" .
    docker push "$GCR_HOSTNAME/$PROJECT_ID/$BACKEND_SERVICE_NAME"
    cd ..
    
    # Frontend
    echo "Building frontend image..."
    cd frontend
    docker build -t "$GCR_HOSTNAME/$PROJECT_ID/$FRONTEND_SERVICE_NAME" .
    docker push "$GCR_HOSTNAME/$PROJECT_ID/$FRONTEND_SERVICE_NAME"
    cd ..
    
    echo "Docker images built and pushed successfully"
}

# Function to deploy services to Cloud Run
function deploy_services {
    echo "Deploying services to Google Cloud Run"
    
    # Set project
    gcloud config set project "$PROJECT_ID"
    
    # Get the Cloud SQL instance connection name
    DB_CONNECTION_NAME=$(gcloud sql instances describe "$DB_INSTANCE_NAME" --format='value(connectionName)')
    
    # Get the database host IP
    DB_HOST=$(gcloud sql instances describe "$DB_INSTANCE_NAME" --format='value(ipAddresses[0].ipAddress)')
    
    # Deploy backend service
    echo "Deploying backend service: $BACKEND_SERVICE_NAME"
    gcloud run deploy "$BACKEND_SERVICE_NAME" \
        --image="$GCR_HOSTNAME/$PROJECT_ID/$BACKEND_SERVICE_NAME" \
        --region="$REGION" \
        --platform=managed \
        --allow-unauthenticated \
        --memory=512Mi \
        --cpu=1 \
        --set-env-vars="POSTGRES_SERVER=$DB_HOST" \
        --set-env-vars="POSTGRES_USER=$DB_USER" \
        --set-env-vars="POSTGRES_DB=$DB_NAME" \
        --set-env-vars="UPLOAD_FOLDER=/tmp/uploads" \
        --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID" \
        --set-env-vars="GOOGLE_CLOUD_STORAGE_BUCKET=$STORAGE_BUCKET" \
        --set-env-vars="GIN_MODE=release" \
        --set-secrets="POSTGRES_PASSWORD=construction-map-db-password:latest" \
        --set-secrets="SECRET_KEY=construction-map-secret-key:latest"
    
    # Get the backend service URL
    BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE_NAME" \
        --region="$REGION" \
        --format='value(status.url)')
    
    # Deploy frontend service
    echo "Deploying frontend service: $FRONTEND_SERVICE_NAME"
    gcloud run deploy "$FRONTEND_SERVICE_NAME" \
        --image="$GCR_HOSTNAME/$PROJECT_ID/$FRONTEND_SERVICE_NAME" \
        --region="$REGION" \
        --platform=managed \
        --allow-unauthenticated \
        --memory=256Mi \
        --cpu=1 \
        --set-env-vars="API_URL=$BACKEND_URL"
    
    # Get the frontend service URL
    FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE_NAME" \
        --region="$REGION" \
        --format='value(status.url)')
    
    echo ""
    echo "Deployment completed successfully!"
    echo "---------------------------------"
    echo "Backend service URL: $BACKEND_URL"
    echo "Frontend service URL: $FRONTEND_URL"
    echo ""
    echo "Next steps:"
    echo "1. Set up a custom domain in Google Cloud Run"
    echo "2. Configure Nginx as a reverse proxy if needed"
    echo "3. Set up SSL with Let's Encrypt"
}

# Main function
case "$1" in
    setup)
        setup_cloud_resources
        ;;
    build)
        build_and_push_images
        ;;
    deploy)
        deploy_services
        ;;
    all)
        setup_cloud_resources
        build_and_push_images
        deploy_services
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