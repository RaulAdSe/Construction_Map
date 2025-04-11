#!/bin/bash

# Set colors for better output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Restarting Servers ===${NC}"

# Function to check if a port is in use
is_port_in_use() {
  lsof -i :$1 &>/dev/null
  return $?
}

# Function to kill processes on a specific port
kill_process_on_port() {
  local port=$1
  echo -e "${YELLOW}Finding processes on port $port...${NC}"
  
  if is_port_in_use $port; then
    local pids=$(lsof -t -i:$port)
    if [ -n "$pids" ]; then
      echo -e "${RED}Killing PIDs: $pids${NC}"
      kill -9 $pids
      sleep 1
      echo -e "${GREEN}Port $port is now free.${NC}"
    fi
  else
    echo -e "${GREEN}No processes found on port $port.${NC}"
  fi
}

# Function to wait for a service to be available on a port
wait_for_service() {
  local port=$1
  local service_name=$2
  local max_attempts=$3
  local attempt=1

  echo -e "${YELLOW}Waiting for $service_name to start on port $port...${NC}"
  
  while ! is_port_in_use $port; do
    if [ $attempt -gt $max_attempts ]; then
      echo -e "${RED}$service_name failed to start after $max_attempts attempts.${NC}"
      echo -e "${YELLOW}Check the logs in logs/$service_name.log for errors.${NC}"
      return 1
    fi
    
    echo -e "${YELLOW}Waiting for $service_name to start (attempt $attempt/$max_attempts)...${NC}"
    sleep 2
    attempt=$((attempt + 1))
  done
  
  echo -e "${GREEN}$service_name successfully started on port $port!${NC}"
  return 0
}

# Function to check if the backend API is responding
check_backend_api() {
  local max_attempts=$1
  local attempt=1
  
  echo -e "${YELLOW}Checking if backend API is responding...${NC}"
  
  while [ $attempt -le $max_attempts ]; do
    if curl -s http://localhost:8000/ > /dev/null; then
      echo -e "${GREEN}Backend API is responding!${NC}"
      return 0
    fi
    
    echo -e "${YELLOW}Waiting for backend API to respond (attempt $attempt/$max_attempts)...${NC}"
    sleep 2
    attempt=$((attempt + 1))
  done
  
  echo -e "${RED}Backend API failed to respond after $max_attempts attempts.${NC}"
  echo -e "${YELLOW}Check logs/backend.log for errors.${NC}"
  return 1
}

# ---------- STOP SERVERS ----------
echo -e "${YELLOW}Stopping any running servers...${NC}"

# Kill any existing servers on ports 3000 and 8000
kill_process_on_port 3000
kill_process_on_port 8000

# Read saved PIDs if available
if [ -f .server_pids ]; then
  read BACKEND_PID FRONTEND_PID < .server_pids
  
  # Kill processes by PID
  if [ -n "$BACKEND_PID" ]; then
    echo -e "${YELLOW}Killing backend process (PID: $BACKEND_PID)...${NC}"
    if ps -p $BACKEND_PID > /dev/null; then
      kill -9 $BACKEND_PID 2>/dev/null || true
      echo -e "${GREEN}Successfully killed backend process.${NC}"
    else
      echo -e "${YELLOW}Backend process (PID: $BACKEND_PID) is not running.${NC}"
    fi
  fi
  
  if [ -n "$FRONTEND_PID" ]; then
    echo -e "${YELLOW}Killing frontend process (PID: $FRONTEND_PID)...${NC}"
    if ps -p $FRONTEND_PID > /dev/null; then
      kill -9 $FRONTEND_PID 2>/dev/null || true
      echo -e "${GREEN}Successfully killed frontend process.${NC}"
    else
      echo -e "${YELLOW}Frontend process (PID: $FRONTEND_PID) is not running.${NC}"
    fi
  fi
  
  # Remove the PID file
  rm .server_pids
  echo -e "${GREEN}Removed PID file.${NC}"
else
  echo -e "${YELLOW}No PID file found, relying on port-based process termination.${NC}"
fi

# Verify all processes are stopped
if is_port_in_use 3000 || is_port_in_use 8000; then
  echo -e "${RED}Warning: Some processes may still be running.${NC}"
  echo -e "${YELLOW}You may need to manually kill them:${NC}"
  echo -e "lsof -i :3000 -i :8000"
  echo -e "kill -9 <PID>"
  exit 1
else
  echo -e "${GREEN}All servers successfully stopped.${NC}"
fi

echo -e "${YELLOW}Waiting 2 seconds before starting servers...${NC}"
sleep 2

# ---------- START SERVERS ----------
echo -e "${YELLOW}Starting servers...${NC}"

# Create log directories if they don't exist
mkdir -p logs

# Navigate to the project root
cd "$(dirname "$0")" # Ensure we're in the script's directory

# Activate the virtual environment
if [ -d "venv311" ]; then
  echo -e "${YELLOW}Activating venv311 virtual environment...${NC}"
  source venv311/bin/activate
else
  echo -e "${RED}Error: Virtual environment venv311 not found!${NC}"
  exit 1
fi

# Check Python is working properly
if ! python --version > /dev/null 2>&1; then
  echo -e "${RED}Error: Python not available after activating virtual environment!${NC}"
  exit 1
fi

# Kill existing processes
echo "Stopping existing servers..."
pkill -f "uvicorn app.main:app" || true
pkill -f "npm start" || true

# Start backend server
echo "Starting backend server..."
cd backend
uvicorn app.main:app --reload --port 8000 &
cd ..

# Start frontend server
echo "Starting frontend server..."
cd frontend
npm start &

echo "Servers are starting. Frontend will be available at http://localhost:3000"
echo "Backend will be available at http://localhost:8000"

# Save PIDs to file for potential future use
echo "$BACKEND_PID $FRONTEND_PID" > .server_pids

# Instructions for the user
echo -e "${GREEN}=== Servers Successfully Restarted ===${NC}"
echo -e "Frontend: ${GREEN}http://localhost:3000${NC}"
echo -e "Backend: ${GREEN}http://localhost:8000${NC}"
echo -e "Logs are saved in the logs directory"
echo -e "${YELLOW}To view backend logs:${NC} tail -f logs/backend.log"
echo -e "${YELLOW}To view frontend logs:${NC} tail -f logs/frontend.log"
echo -e "${YELLOW}To stop the servers, run:${NC} ./stop_servers.sh" 