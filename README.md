# Construction Map Application

A web application for managing construction projects, maps, and events.

## Key Features

- Project management with creation, viewing, and deletion functionality
- Map uploads and visualization
- Event tracking for construction projects
- User authentication

## Tech Stack

- Backend: FastAPI with SQLAlchemy ORM
- Database: PostgreSQL
- Frontend: HTML, CSS, JavaScript with fetch API
- Authentication: JWT tokens

## Development

### Backend

```
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```
cd frontend
python -m http.server 3000
```

## Database Setup

PostgreSQL database with the following configuration:
- Host: localhost
- Port: 5432
- User: postgres
- Password: postgres
- Database: construction_map

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