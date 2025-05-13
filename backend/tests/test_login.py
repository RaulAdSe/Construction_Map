#!/usr/bin/env python
"""
Test login functionality with admin/admin credentials
"""
import requests
import json

# API endpoint
url = "https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/auth/login"

# Credentials as form data
form_data = {
    "username": "admin",
    "password": "admin",
    "grant_type": "password"  # This is required for OAuth2 form
}

# Make the request
print(f"Sending request to {url}")
print(f"Form data: {form_data}")

response = requests.post(
    url,
    data=form_data,  # Send as form data, not JSON
    headers={"Content-Type": "application/x-www-form-urlencoded"}
)

# Print the response
print(f"Status code: {response.status_code}")
print(f"Response headers: {response.headers}")
try:
    print(f"Response body: {json.dumps(response.json(), indent=2)}")
except:
    print(f"Response body: {response.text}") 