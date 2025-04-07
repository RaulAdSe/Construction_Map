#!/bin/bash

# Servitec Map Full Application Deployment Script
# This script deploys both the backend API and frontend to Cloud Run

set -e

# Print banner
echo "=============================================="
echo "  Servitec Map - Full Application Deployment  "
echo "=============================================="
echo

echo "This script will deploy both the backend API and frontend to Cloud Run."
echo "The process will deploy in this order:"
echo "1. Backend API"
echo "2. Frontend (using the backend API URL)"
echo

read -p "Do you want to continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Check for environment files in the backend directory
if [ -f backend/.env.production ]; then
    echo "Found backend/.env.production file"
    ENV_FILE="backend/.env.production"
elif [ -f backend/.env ]; then
    echo "Found backend/.env file"
    ENV_FILE="backend/.env"
else
    echo "No environment file found in backend directory."
    echo "Creating one from the production example..."
    
    if [ ! -f backend/.env.production.example ]; then
        echo "ERROR: backend/.env.production.example does not exist!"
        echo "Please make sure you have the correct repository structure."
        exit 1
    fi
    
    cp backend/.env.production.example backend/.env.production
    ENV_FILE="backend/.env.production"
    
    # Ask for password
    read -s -p "Enter database password: " DB_PASSWORD
    echo
    
    if [ -z "$DB_PASSWORD" ]; then
        echo "Error: Database password cannot be empty"
        exit 1
    fi
    
    # Use sed to replace the placeholder password in the .env.production file
    sed -i -e "s/DB_PASSWORD=your_secure_production_password/DB_PASSWORD=$DB_PASSWORD/" backend/.env.production
    echo "Created and configured backend/.env.production with your database password"
fi

echo "Using environment file: $ENV_FILE"

# Step 1: Deploy the backend
echo
echo "=============================================="
echo "STEP 1: Deploying Backend API"
echo "=============================================="
echo

cd backend
./deploy_final.sh
BACKEND_RESULT=$?
# If deployment was cancelled by the user, exit
if [ $BACKEND_RESULT -ne 0 ]; then
    echo "Backend deployment was cancelled or failed. Exiting."
    exit 1
fi
cd ..

# Step 2: Deploy the frontend
echo
echo "=============================================="
echo "STEP 2: Deploying Frontend"
echo "=============================================="
echo

cd frontend
./deploy_frontend.sh
# If deployment was cancelled by the user, exit
if [ $? -ne 0 ]; then
    echo "Frontend deployment was cancelled or failed. Exiting."
    exit 1
fi
cd ..

# Get the URLs
BACKEND_URL=$(gcloud run services describe servitec-map-api --platform managed --region us-central1 --format 'value(status.url)')
FRONTEND_URL=$(gcloud run services describe servitec-map-frontend --platform managed --region us-central1 --format 'value(status.url)')

echo
echo "=============================================="
echo "Servitec Map Full Application Deployment Complete!"
echo "=============================================="
echo
echo "Backend API URL: $BACKEND_URL"
echo "API Documentation: $BACKEND_URL/docs"
echo "Health Check: $BACKEND_URL/health"
echo
echo "Frontend URL: $FRONTEND_URL"
echo "=============================================="
echo
echo "Your Servitec Map application is now fully deployed!"
echo "Open the Frontend URL in your browser to start using the application." 