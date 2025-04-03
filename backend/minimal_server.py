#!/usr/bin/env python3
"""
Ultra minimal HTTP server that just listens on port 8080
with no external dependencies
"""

import os
import http.server
import socketserver
import time

PORT = int(os.environ.get('PORT', 8080))

class SimpleHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        response = '{"status": "healthy", "message": "Minimal server is running"}'
        self.wfile.write(response.encode())
        
    def log_message(self, format, *args):
        print(f"Request: {args[0]} {args[1]} {args[2]}")

print(f"Starting minimal HTTP server on port {PORT}")
print(f"Environment variables: PORT={PORT}")
print(f"Current directory: {os.getcwd()}")
print(f"Files in current directory: {os.listdir('.')}")

try:
    with socketserver.TCPServer(("0.0.0.0", PORT), SimpleHandler) as httpd:
        print(f"Server started at http://0.0.0.0:{PORT}")
        httpd.serve_forever()
except Exception as e:
    print(f"ERROR starting server: {str(e)}")
    # Sleep to keep container alive for logging
    time.sleep(60) 