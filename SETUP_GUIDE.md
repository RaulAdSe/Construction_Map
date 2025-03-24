# Construction Map Application Setup Guide

## Overview
This guide provides instructions for setting up and running both the frontend and backend components of the Construction Map application.

## Prerequisites
- Python 3.11+
- Node.js and npm
- Git

## Repository Setup
```bash
git clone https://github.com/RaulAdSe/Construction_Map.git
cd Construction_Map
```

## Backend Setup

### 1. Create and activate virtual environment
```bash
python -m venv venv311
source venv311/bin/activate  # On Windows: venv311\Scripts\activate
```

### 2. Install backend dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 3. Start the backend server
```bash
python run_server.py
```

The backend server will start on port 8000.

## Frontend Setup

### 1. Install frontend dependencies
```bash
cd frontend
npm install
```

### 2. Start the development server
```bash
npm start
```

The frontend development server will start on port 3000.

## Access the Application
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## Default Admin Credentials
- Username: admin
- Password: password

## Common Issues and Solutions

### Connection Timeout
If you experience connection timeouts when logging in:
1. Make sure both backend and frontend servers are running
2. Check that the backend server is accessible at http://localhost:8000
3. Verify that port 8000 is not being used by another application

### CORS Issues
If you encounter CORS errors in the browser console:
1. Verify that the backend CORS configuration in `backend/app/main.py` includes your frontend origin
2. Ensure the frontend is using the correct API URL (http://localhost:8000)

## Troubleshooting
- Check for error messages in the backend console
- Use browser developer tools to inspect network requests
- If all else fails, restart both servers

## Production Deployment
For production deployment, additional configuration steps are required:
1. Build the frontend: `cd frontend && npm run build`
2. Serve the frontend using a production-ready web server (Nginx, Apache, etc.)
3. Configure the backend for production (disable debug mode, use proper WSGI server)
4. Set up proper authentication and security measures 