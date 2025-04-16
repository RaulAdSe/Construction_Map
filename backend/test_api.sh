#!/bin/bash
# Script to test multiple backend endpoints

# Get the backend URL from the deployed service
BACKEND_URL=$(gcloud run services describe construction-map-backend --region=us-central1 --format 'value(status.url)')

echo "Testing backend API at $BACKEND_URL"
echo "--------------------------------------------"

# Function to make a colored output
print_status() {
  local status=$1
  local message=$2
  if [ "$status" == "SUCCESS" ]; then
    echo -e "\e[32m$status\e[0m: $message"
  else
    echo -e "\e[31m$status\e[0m: $message"
  fi
}

# Test 1: Basic health check
echo "💡 Test 1: Basic API availability"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/v1/health" 2>/dev/null)
if [ "$RESPONSE" == "200" ] || [ "$RESPONSE" == "404" ]; then
  # 404 is also acceptable here since we might not have a health endpoint
  print_status "SUCCESS" "Backend API is reachable (status: $RESPONSE)"
else
  print_status "FAILURE" "Backend API is not reachable (status: $RESPONSE)"
fi
echo ""

# Test 2: Login with admin user
echo "💡 Test 2: Login with admin credentials"
LOGIN_RESPONSE=$(curl -s -X POST \
  "$BACKEND_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}')

if echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
  print_status "SUCCESS" "Login successful! Token received."
  # Extract token for further requests
  TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
  echo "Token received: ${TOKEN:0:20}..."
else
  print_status "FAILURE" "Login failed. Response:"
  echo "$LOGIN_RESPONSE" | jq . 2>/dev/null || echo "$LOGIN_RESPONSE"
fi
echo ""

# Test 3: Try accessing a protected endpoint
if [ -n "$TOKEN" ]; then
  echo "💡 Test 3: Accessing protected endpoint (user profile)"
  PROFILE_RESPONSE=$(curl -s -X GET \
    "$BACKEND_URL/api/v1/users/me" \
    -H "Authorization: Bearer $TOKEN")
  
  if echo "$PROFILE_RESPONSE" | grep -q "username"; then
    print_status "SUCCESS" "Profile endpoint accessible"
    echo "$PROFILE_RESPONSE" | jq . 2>/dev/null || echo "$PROFILE_RESPONSE"
  else
    print_status "FAILURE" "Couldn't access profile endpoint. Response:"
    echo "$PROFILE_RESPONSE" | jq . 2>/dev/null || echo "$PROFILE_RESPONSE"
  fi
  echo ""
fi

# Test 4: Try accessing monitoring endpoint (admin only)
if [ -n "$TOKEN" ]; then
  echo "💡 Test 4: Accessing admin monitoring endpoint"
  MONITORING_RESPONSE=$(curl -s -X GET \
    "$BACKEND_URL/api/v1/monitoring/health/system" \
    -H "Authorization: Bearer $TOKEN")
  
  if echo "$MONITORING_RESPONSE" | grep -q "status"; then
    print_status "SUCCESS" "Monitoring endpoint accessible (admin privileges confirmed)"
    echo "$MONITORING_RESPONSE" | jq . 2>/dev/null || echo "$MONITORING_RESPONSE"
  else
    print_status "FAILURE" "Couldn't access monitoring endpoint. Response:"
    echo "$MONITORING_RESPONSE" | jq . 2>/dev/null || echo "$MONITORING_RESPONSE"
  fi
  echo ""
fi

echo "--------------------------------------------"
echo "Tests completed. If any tests failed, check the backend logs with:"
echo "gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=construction-map-backend\" --limit 50" 