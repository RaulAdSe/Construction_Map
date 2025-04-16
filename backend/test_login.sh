#!/bin/bash
# Script to test the login endpoint

# Get the backend URL from the deployed service
BACKEND_URL=$(gcloud run services describe construction-map-backend --region=us-central1 --format 'value(status.url)')

echo "Testing login for admin user at $BACKEND_URL"
echo "--------------------------------------------"

# Test the login endpoint
curl -X POST \
  "$BACKEND_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  | jq . || echo "Failed to parse JSON response. Raw response:"

echo ""
echo "If you see an access_token in the response, login was successful."
echo "If you see an error, check the credentials or the backend logs." 