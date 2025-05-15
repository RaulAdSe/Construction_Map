import requests
import sys
import json
import os

# Base URL of the API
BASE_URL = "http://localhost:8000/api/v1"

# Sample JWT token for authentication (replace with a valid token)
# You can get a valid token by logging in through the UI and checking localStorage
TOKEN = None  # Will be set after login

def login(username="admin", password="admin"):
    """Login to get a valid JWT token"""
    url = f"{BASE_URL}/auth/login"  # Correct endpoint path
    response = requests.post(
        url, 
        data={"username": username, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    
    if response.status_code == 200:
        global TOKEN
        data = response.json()
        TOKEN = data.get("access_token")
        print(f"✅ Successfully logged in as {username}")
        return True
    else:
        print(f"❌ Login failed: {response.status_code} {response.text}")
        return False

def test_endpoint(endpoint, method="GET", data=None, expected_status=200):
    """Test an API endpoint"""
    url = f"{BASE_URL}{endpoint}"
    headers = {"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}
    
    print(f"\nTesting {method} {url}")
    
    if method == "GET":
        response = requests.get(url, headers=headers)
    elif method == "POST":
        response = requests.post(url, json=data, headers=headers)
    elif method == "PUT":
        response = requests.put(url, json=data, headers=headers)
    elif method == "DELETE":
        response = requests.delete(url, headers=headers)
    else:
        print(f"❌ Unsupported method: {method}")
        return False
    
    # Check status code
    if response.status_code != expected_status:
        print(f"❌ Expected status {expected_status}, got {response.status_code}")
        print(f"Response: {response.text}")
        return False
    
    print(f"✅ Status: {response.status_code}")
    
    # For successful responses, print a preview of the data
    if 200 <= response.status_code < 300:
        try:
            data = response.json()
            if isinstance(data, list):
                preview = data[:2] if len(data) > 2 else data
                print(f"Data preview (first {len(preview)} of {len(data)} items):")
                print(json.dumps(preview, indent=2))
            else:
                print("Data preview:")
                print(json.dumps(data, indent=2))
        except:
            print(f"Response: {response.text[:100]}...")
    
    return True

def test_comments_endpoint(event_id=50):
    """Test the comments endpoint specifically"""
    return test_endpoint(f"/events/{event_id}/comments")

def test_event_history_endpoint(event_id=50):
    """Test the event history endpoint specifically"""
    return test_endpoint(f"/events/{event_id}/history")

def main():
    # First login to get a token
    if not login():
        sys.exit(1)
    
    # Test the problematic endpoints
    comments_ok = test_comments_endpoint()
    history_ok = test_event_history_endpoint()
    
    if comments_ok and history_ok:
        print("\n✅ All tests passed!")
    else:
        print("\n❌ Some tests failed")
        sys.exit(1)

if __name__ == "__main__":
    main() 