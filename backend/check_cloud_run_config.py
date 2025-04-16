#!/usr/bin/env python3
import os
import subprocess
import json
import sys

print("Cloud Run Configuration Diagnostic Tool")
print("======================================\n")

# Define the service name
SERVICE_NAME = "construction-map-backend"
REGION = "us-central1"
PROJECT_ID = os.environ.get("PROJECT_ID", "deep-responder-444017-h2")

def run_command(cmd):
    try:
        print(f"Running: {cmd}")
        result = subprocess.run(cmd, shell=True, check=True, text=True, capture_output=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {e}")
        print(f"stderr: {e.stderr}")
        return None

# Check if the Cloud Run service exists
print("1. Checking Cloud Run service...")
service_url = run_command(f"gcloud run services describe {SERVICE_NAME} --region={REGION} --format='value(status.url)'")
if not service_url:
    print(f"❌ Cloud Run service '{SERVICE_NAME}' not found in region '{REGION}'")
    print("   Please check if the service name and region are correct.")
    sys.exit(1)
else:
    print(f"✅ Cloud Run service is running at: {service_url}")
print()

# Check Cloud SQL connection
print("2. Checking Cloud SQL configuration...")
cloudsql_instances = run_command(f"gcloud run services describe {SERVICE_NAME} --region={REGION} --format='value(spec.template.annotations.\"run.googleapis.com/cloudsql-instances\")'")

if not cloudsql_instances:
    print("❌ No Cloud SQL instances configured for this service")
    print("   The Cloud SQL connection annotation is not set properly.")
    print("\n   Fix: Add the following annotation to your service:")
    print(f"   run.googleapis.com/cloudsql-instances=[YOUR_INSTANCE_CONNECTION_NAME]")
else:
    print(f"✅ Cloud SQL instance(s) configured: {cloudsql_instances}")

# Check environment variables
print("3. Checking environment variables...")
env_vars_json = run_command(f"gcloud run services describe {SERVICE_NAME} --region={REGION} --format='json(spec.template.spec.containers[0].env)'")
if env_vars_json:
    try:
        env_vars = json.loads(env_vars_json)
        cloud_db_instance = None
        cloud_db_iam_user = None
        
        # Parse the environment variables
        for env in env_vars:
            if isinstance(env, dict):
                if env.get('name') == 'CLOUD_DB_INSTANCE':
                    cloud_db_instance = env.get('value')
                elif env.get('name') == 'CLOUD_DB_IAM_USER':
                    cloud_db_iam_user = env.get('value')
        
        if cloud_db_instance:
            print(f"✅ CLOUD_DB_INSTANCE is set to: {cloud_db_instance}")
            # Check if CLOUD_DB_INSTANCE matches the Cloud SQL annotation
            if cloudsql_instances and cloud_db_instance != cloudsql_instances:
                print(f"⚠️ Warning: CLOUD_DB_INSTANCE ({cloud_db_instance}) does not match the Cloud SQL annotation ({cloudsql_instances})")
        else:
            print("❌ CLOUD_DB_INSTANCE environment variable is not set")
        
        if cloud_db_iam_user:
            print(f"✅ CLOUD_DB_IAM_USER is set to: {cloud_db_iam_user}")
        else:
            print("❌ CLOUD_DB_IAM_USER environment variable is not set")
    except json.JSONDecodeError:
        print(f"❌ Failed to parse environment variables JSON: {env_vars_json}")
print()

# Check IAM permissions
print("4. Checking IAM permissions...")
service_account = run_command(f"gcloud run services describe {SERVICE_NAME} --region={REGION} --format='value(spec.template.spec.serviceAccountName)'")
if not service_account:
    print("❌ No service account configured for this Cloud Run service")
    print("   The service is using the default Compute Engine service account.")
else:
    print(f"✅ Service account configured: {service_account}")
    
    # Check if the service account has the Cloud SQL Client role
    iam_policy = run_command(f"gcloud projects get-iam-policy {PROJECT_ID} --format='json(bindings)' | jq '.bindings[] | select(.role==\"roles/cloudsql.client\") | .members'")
    if iam_policy and service_account in iam_policy:
        print(f"✅ Service account has the Cloud SQL Client role")
    else:
        print(f"❌ Service account may not have the Cloud SQL Client role")
        print(f"   Fix: Run the following command:")
        print(f"   gcloud projects add-iam-policy-binding {PROJECT_ID} --member='serviceAccount:{service_account}' --role='roles/cloudsql.client'")
print()

# Final recommendations
print("5. Recommendations:")
print("   1. Ensure your Cloud SQL instance is in the same region as your Cloud Run service")
print("   2. Make sure IAM authentication is enabled for your Cloud SQL instance")
print("   3. Check that the Unix socket path in your code matches the Cloud SQL instance name")
print("   4. Ensure your service account has the 'Cloud SQL Client' role")
print("   5. Check the logs for more detailed error messages:")
print(f"      gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name={SERVICE_NAME}' --limit=20 --format='table(timestamp,severity,textPayload)'") 