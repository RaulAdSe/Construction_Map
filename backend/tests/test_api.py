#!/usr/bin/env python3
"""
Script to test the backend API endpoints
"""
import os
import json
import subprocess
import requests
from colorama import init, Fore, Style

# Initialize colorama for cross-platform colored output
init()

def print_status(status, message):
    """Print colored status messages"""
    if status == "SUCCESS":
        print(f"{Fore.GREEN}{status}{Style.RESET_ALL}: {message}")
    else:
        print(f"{Fore.RED}{status}{Style.RESET_ALL}: {message}")

def get_backend_url():
    """Get the backend URL from the deployed service"""
    try:
        result = subprocess.run(
            ["gcloud", "run", "services", "describe", "construction-map-backend", 
             "--region=us-central1", "--format=value(status.url)"],
            capture_output=True, text=True, check=True
        )
        url = result.stdout.strip()
        if not url:
            raise ValueError("Empty URL returned")
        return url
    except Exception as e:
        print(f"{Fore.RED}Error getting backend URL: {e}{Style.RESET_ALL}")
        return input("Please enter the backend URL manually: ")

def test_api_availability(base_url):
    """Test if the API is reachable"""
    print("\n💡 Test 1: Basic API availability")
    try:
        response = requests.get(f"{base_url}/api/v1/health", timeout=10)
        print_status("SUCCESS", f"Backend API is reachable (status: {response.status_code})")
        return True
    except requests.RequestException as e:
        # Try alternative endpoint if health endpoint doesn't exist
        try:
            response = requests.get(base_url, timeout=10)
            print_status("SUCCESS", f"Backend is reachable at base URL (status: {response.status_code})")
            return True
        except requests.RequestException as e2:
            print_status("FAILURE", f"Backend API is not reachable: {e2}")
            return False

def test_login(base_url):
    """Test login with admin credentials"""
    print("\n💡 Test 2: Login with admin credentials")
    try:
        response = requests.post(
            f"{base_url}/api/v1/auth/login",
            json={"username": "admin", "password": "admin"},
            timeout=10
        )
        
        if response.status_code == 200 and "access_token" in response.text:
            data = response.json()
            token = data.get("access_token")
            print_status("SUCCESS", "Login successful! Token received.")
            print(f"Token: {token[:20]}...")
            return token
        else:
            print_status("FAILURE", f"Login failed (status: {response.status_code})")
            print(f"Response: {response.text}")
            return None
    except requests.RequestException as e:
        print_status("FAILURE", f"Login request failed: {e}")
        return None

def test_user_profile(base_url, token):
    """Test accessing a protected user profile endpoint"""
    print("\n💡 Test 3: Accessing protected endpoint (user profile)")
    if not token:
        print_status("SKIPPED", "No authentication token available")
        return
    
    try:
        response = requests.get(
            f"{base_url}/api/v1/users/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        
        if response.status_code == 200 and "username" in response.text:
            print_status("SUCCESS", "User profile endpoint accessible")
            print(json.dumps(response.json(), indent=2))
        else:
            print_status("FAILURE", f"Couldn't access profile endpoint (status: {response.status_code})")
            print(f"Response: {response.text}")
    except requests.RequestException as e:
        print_status("FAILURE", f"Profile request failed: {e}")

def test_monitoring_endpoint(base_url, token):
    """Test accessing an admin-only monitoring endpoint"""
    print("\n💡 Test 4: Accessing admin monitoring endpoint")
    if not token:
        print_status("SKIPPED", "No authentication token available")
        return
    
    try:
        response = requests.get(
            f"{base_url}/api/v1/monitoring/health/system",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10
        )
        
        if response.status_code == 200 and "status" in response.text:
            print_status("SUCCESS", "Monitoring endpoint accessible (admin privileges confirmed)")
            print(json.dumps(response.json(), indent=2))
        else:
            print_status("FAILURE", f"Couldn't access monitoring endpoint (status: {response.status_code})")
            print(f"Response: {response.text}")
    except requests.RequestException as e:
        print_status("FAILURE", f"Monitoring request failed: {e}")

def main():
    """Main function to run all tests"""
    print(f"{Fore.CYAN}Testing backend API...{Style.RESET_ALL}")
    
    base_url = get_backend_url()
    print(f"Backend URL: {base_url}")
    print("--------------------------------------------")

    if not test_api_availability(base_url):
        print(f"\n{Fore.RED}Cannot reach backend API. Aborting tests.{Style.RESET_ALL}")
        return
    
    token = test_login(base_url)
    
    test_user_profile(base_url, token)
    test_monitoring_endpoint(base_url, token)
    
    print("\n--------------------------------------------")
    print("Tests completed. If any tests failed, check the backend logs:")
    print("gcloud logging read \"resource.type=cloud_run_revision AND resource.labels.service_name=construction-map-backend\" --limit 50")

if __name__ == "__main__":
    main() 