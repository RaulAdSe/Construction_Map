#!/bin/bash

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Stopping servers...${NC}"

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
else
  echo -e "${GREEN}All servers successfully stopped.${NC}"
fi
