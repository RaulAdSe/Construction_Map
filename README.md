# Construction Map

A map-based construction project management application.

## Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- PostgreSQL 13+

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/YourUsername/Construction_Map.git
cd Construction_Map
```

### 2. Backend Setup

```bash
# Create and activate virtual environment
python -m venv venv311
source venv311/bin/activate  # On Windows: venv311\Scripts\activate

# Install dependencies
cd backend
pip install -r requirements.txt

# Set up database
# Create a PostgreSQL database named 'construction_map'
# The default credentials are: postgres/postgres

# Run migrations
alembic upgrade head

# Return to project root
cd ..
```

### 3. Frontend Setup

```bash
cd frontend
npm install
cd ..
```

### 4. Start the Application

```bash
# Start both backend and frontend with the helper script
chmod +x restart_servers.sh
./restart_servers.sh
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## Development

### Available Scripts

- `./restart_servers.sh`: Starts both backend and frontend servers
- `./restart_servers.sh -f`: Runs the backend in foreground mode for debugging
- `./restart_servers.sh -l`: Shows backend logs while running
- `./restart_servers.sh -n`: Doesn't open browser automatically

### Default Admin Account

- Username: admin
- Password: password

## Project Structure

- `/backend`: Python FastAPI backend
- `/frontend`: React frontend
- `/docs`: Documentation 