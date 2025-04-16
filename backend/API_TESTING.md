# Backend API Testing

This document explains how to test the backend API after deployment to Cloud Run, without requiring the frontend to be deployed.

## Prerequisites

- Google Cloud SDK (`gcloud`) installed and configured
- The backend service deployed to Cloud Run (using `deploy_to_cloud_run.sh`)
- For the Python script: Python 3.6+ with the `requests` and `colorama` libraries

## Using the Bash Script

1. Make the script executable:
   ```bash
   chmod +x test_api.sh
   ```

2. Run the script:
   ```bash
   ./test_api.sh
   ```

The script will:
- Get the URL of your Cloud Run service
- Test if the API is reachable
- Attempt to login with admin credentials (username: `admin`, password: `admin`)
- If login is successful, test a protected user profile endpoint
- Test an admin-only monitoring endpoint

## Using the Python Script

1. Install the required dependencies:
   ```bash
   pip install requests colorama
   ```

2. Make the script executable:
   ```bash
   chmod +x test_api.py
   ```

3. Run the script:
   ```bash
   ./test_api.py
   ```

The Python script performs the same tests as the Bash script but with better error handling and cross-platform compatibility.

## Testing with curl

If you prefer to test individual endpoints, you can use curl:

1. Get the backend URL:
   ```bash
   BACKEND_URL=$(gcloud run services describe construction-map-backend --region=us-central1 --format 'value(status.url)')
   echo $BACKEND_URL
   ```

2. Login with admin user:
   ```bash
   curl -X POST \
     "$BACKEND_URL/api/v1/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin"}'
   ```

3. If login was successful, you'll receive a response with an access token:
   ```json
   {
     "access_token": "eyJhbGciOiJIUzI1NiIs...",
     "token_type": "bearer",
     "user": {
       "id": 1,
       "username": "admin",
       "is_admin": true
     }
   }
   ```

4. Use the token to access protected endpoints:
   ```bash
   curl -X GET \
     "$BACKEND_URL/api/v1/users/me" \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```

## Troubleshooting

If login fails:
1. Check the backend logs:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=construction-map-backend" --limit 50
   ```

2. Verify the admin user creation script is running:
   - Check the Dockerfile to ensure `create_servitec_admin.py` is being run during startup
   - Check the logs for any errors during user creation

3. Try manually triggering admin user creation:
   ```bash
   gcloud run jobs create create-admin-user \
     --image [YOUR_IMAGE_URL] \
     --service-account servitec-map-service@deep-responder-444017-h2.iam.gserviceaccount.com \
     --command "python" \
     --args "create_servitec_admin.py"
   ``` 