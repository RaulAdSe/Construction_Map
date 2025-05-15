#!/bin/bash

# Set colors for better output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Setting up Construction Map Project ===${NC}"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Python 3 is not installed. Please install Python 3.11 or higher.${NC}"
    exit 1
else
    PYTHON_VERSION=$(python3 --version | awk '{print $2}')
    echo -e "${GREEN}Found Python $PYTHON_VERSION${NC}"
fi

# Check pip
if ! command -v pip &> /dev/null; then
    echo -e "${RED}pip is not installed. Please install pip.${NC}"
    exit 1
else
    PIP_VERSION=$(pip --version | awk '{print $2}')
    echo -e "${GREEN}Found pip $PIP_VERSION${NC}"
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js 18 or higher.${NC}"
    exit 1
else
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}Found Node.js $NODE_VERSION${NC}"
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed. Please install npm.${NC}"
    exit 1
else
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}Found npm $NPM_VERSION${NC}"
fi

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}PostgreSQL client not found. Make sure PostgreSQL is installed and running.${NC}"
else
    PSQL_VERSION=$(psql --version | awk '{print $3}')
    echo -e "${GREEN}Found PostgreSQL client $PSQL_VERSION${NC}"
fi

# Setup Python environment
echo -e "${YELLOW}Setting up Python virtual environment...${NC}"
if [ ! -d "venv311" ]; then
    python3 -m venv venv311
    echo -e "${GREEN}Created virtual environment 'venv311'${NC}"
else
    echo -e "${YELLOW}Virtual environment 'venv311' already exists${NC}"
fi

# Activate virtual environment
echo -e "${YELLOW}Activating virtual environment...${NC}"
source venv311/bin/activate

# Install backend dependencies
echo -e "${YELLOW}Installing backend dependencies...${NC}"
cd backend
pip install -r requirements.txt
cd ..

# Install frontend dependencies
echo -e "${YELLOW}Installing frontend dependencies...${NC}"
cd frontend
npm install
cd ..

# Create necessary directories
echo -e "${YELLOW}Creating necessary directories...${NC}"
mkdir -p logs
mkdir -p backend/uploads

# PostgreSQL check
echo -e "${YELLOW}Checking PostgreSQL database...${NC}"

# Make script executable
chmod +x restart_servers.sh

echo -e "${GREEN}=== Setup completed! ===${NC}"
echo -e "To start the application, run:"
echo -e "${YELLOW}./restart_servers.sh${NC}"
echo -e "Frontend: ${GREEN}http://localhost:3000${NC}"
echo -e "Backend: ${GREEN}http://localhost:8000${NC}"
echo -e "Default admin credentials: admin/password" 