#!/usr/bin/env python3
"""
CORS Test Script

This script tests CORS configuration by simulating requests from different origins.
It helps identify issues with CORS headers before deploying to production.

Usage:
    python cors_test.py
"""

import requests
import json
import sys
from urllib.parse import urlparse
from colorama import init, Fore, Style
import time

# Initialize colorama for colored output
init()

# Define the URLs to test
BACKEND_URLS = [
    "https://construction-map-backend-ypzdt6srya-uc.a.run.app/health",
    "https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/auth/login",
]

# Define origins to test
ORIGINS = [
    "https://construction-map-frontend-ypzdt6srya-uc.a.run.app",
    "https://construction-map-frontend-77413952899.us-central1.run.app",
    "https://coordino.servitecingenieria.com",
    "http://localhost:3000",
    "https://example.com",  # This should be rejected
]

def print_header(message):
    """Print a formatted header message."""
    print(f"\n{Fore.CYAN}{Style.BRIGHT}" + "=" * 80)
    print(f" {message}")
    print("=" * 80 + f"{Style.RESET_ALL}\n")

def print_success(message):
    """Print a success message."""
    print(f"{Fore.GREEN}✓ {message}{Style.RESET_ALL}")

def print_error(message):
    """Print an error message."""
    print(f"{Fore.RED}✗ {message}{Style.RESET_ALL}")

def print_warn(message):
    """Print a warning message."""
    print(f"{Fore.YELLOW}! {message}{Style.RESET_ALL}")

def test_options_request(url, origin):
    """Test OPTIONS request with a specific origin."""
    headers = {
        "Origin": origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, Authorization"
    }
    
    try:
        response = requests.options(url, headers=headers, timeout=10)
        
        # Check if the response contains the necessary CORS headers
        cors_headers = {
            "Access-Control-Allow-Origin": None,
            "Access-Control-Allow-Methods": None,
            "Access-Control-Allow-Headers": None,
            "Access-Control-Allow-Credentials": None
        }
        
        # Extract actual CORS headers
        actual_headers = {}
        for header in cors_headers:
            if header.lower() in response.headers:
                actual_headers[header] = response.headers[header.lower()]
            else:
                actual_headers[header] = None
        
        # Get the domain from the origin
        origin_domain = urlparse(origin).netloc
        
        # Check if origin is properly allowed
        allow_origin = actual_headers["Access-Control-Allow-Origin"]
        if allow_origin == origin:
            print_success(f"Origin '{origin}' allowed correctly in OPTIONS response")
        elif allow_origin == "*":
            print_warn(f"Origin wildcard '*' returned, which might cause credential issues")
        elif allow_origin is None:
            print_error(f"No 'Access-Control-Allow-Origin' header found in OPTIONS response")
        else:
            print_error(f"Expected origin '{origin}', got '{allow_origin}'")
            
        # Check if credentials are allowed
        if actual_headers["Access-Control-Allow-Credentials"] == "true":
            print_success("Credentials are allowed")
        else:
            print_warn("Credentials are not allowed, which might cause authentication issues")
            
        # Print all headers for reference
        print("\nResponse headers:")
        for header, value in response.headers.items():
            print(f"  {header}: {value}")
            
        print(f"\nStatus code: {response.status_code}")
        
        return response.status_code == 200 and allow_origin == origin
        
    except requests.RequestException as e:
        print_error(f"Request failed: {e}")
        return False

def test_get_request(url, origin):
    """Test GET request with a specific origin."""
    headers = {
        "Origin": origin,
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        # Check if the response contains the necessary CORS headers
        allow_origin = response.headers.get("access-control-allow-origin")
        
        if allow_origin == origin:
            print_success(f"Origin '{origin}' allowed correctly in GET response")
        elif allow_origin == "*":
            print_warn(f"Origin wildcard '*' returned, which might cause credential issues")
        elif allow_origin is None:
            print_error(f"No 'Access-Control-Allow-Origin' header found in GET response")
        else:
            print_error(f"Expected origin '{origin}', got '{allow_origin}'")
            
        # Print all headers for reference
        print("\nResponse headers:")
        for header, value in response.headers.items():
            print(f"  {header}: {value}")
            
        print(f"\nStatus code: {response.status_code}")
        
        return response.status_code == 200 and allow_origin == origin
        
    except requests.RequestException as e:
        print_error(f"Request failed: {e}")
        return False

def main():
    """Main function to run CORS tests."""
    print_header("CORS Configuration Test")
    
    success_count = 0
    test_count = 0
    
    for url in BACKEND_URLS:
        print_header(f"Testing URL: {url}")
        
        for origin in ORIGINS:
            print(f"\nTesting with Origin: {origin}")
            
            if 'example.com' in origin:
                print_warn("This is a test for rejected origins, expect failure")
            
            # Test OPTIONS request
            print("\n- Testing OPTIONS request:")
            test_count += 1
            if test_options_request(url, origin):
                success_count += 1
            
            # Short delay between requests
            time.sleep(1)
            
            # Test GET request
            print("\n- Testing GET request:")
            test_count += 1
            if test_get_request(url, origin):
                success_count += 1
            
            # Short delay between origins
            time.sleep(1)
        
        # Short delay between URLs
        time.sleep(2)
    
    # Print summary
    print_header(f"Test Summary: {success_count}/{test_count} tests passed")
    
    if success_count == test_count:
        print_success("All CORS tests passed!")
    else:
        print_error(f"{test_count - success_count} tests failed")
        
    if success_count < test_count:
        sys.exit(1)

if __name__ == "__main__":
    main() 