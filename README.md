# Construction Map Application

A web application for construction project management that allows users to view and overlay construction maps/plans, create pinpoint events/issues on maps, and manage project data.

## Features

- User authentication and authorization
- Project management
- Map viewing with overlay capabilities
- Event creation and management
- Event list and filtering
- Data export

## Tech Stack

- **Backend**: Python with FastAPI
- **Database**: PostgreSQL
- **Frontend**: React (in development)
- **Map Visualization**: Leaflet or OpenLayers (in development)

## Project Structure

```
construction-map/
├── backend/              # FastAPI backend
│   ├── app/              # Application code
│   │   ├── api/          # API endpoints
│   │   ├── core/         # Core application settings
│   │   ├── db/           # Database configuration
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   └── services/     # Business logic services
│   ├── migrations/       # Alembic database migrations
│   └── tests/            # Backend tests
└── frontend/             # React frontend (coming soon)
```

## Getting Started

### Prerequisites

- Python 3.9+
- PostgreSQL 13+
- Node.js 16+ (for frontend)

### Backend Setup

1. Create a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```
   cd backend
   pip install -r requirements.txt
   ```

3. Set up environment variables in a `.env` file:
   ```
   POSTGRES_SERVER=localhost
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_password
   POSTGRES_DB=construction_map
   SECRET_KEY=your_secret_key
   ```

4. Run database migrations:
   ```
   alembic upgrade head
   ```

5. Start the development server:
   ```
   uvicorn app.main:app --reload
   ```

6. Access the API documentation at http://localhost:8000/docs

### Frontend Setup (Coming Soon)

## Development

This project is under active development. The initial version focuses on core functionality and will expand in future iterations.

## License

This project is licensed under the MIT License. 