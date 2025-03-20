# Construction Map API

This is the backend API for the Construction Map application, built with FastAPI and PostgreSQL.

## Features

- RESTful API with SQLAlchemy ORM
- JWT authentication
- File uploads for maps and event images
- Project, map, and event management
- Data export capabilities

## Project Structure

```
backend/
├── app/                  # Application code
│   ├── api/              # API endpoints
│   │   └── v1/           # API version 1
│   │       └── endpoints/ # API endpoint modules
│   ├── core/             # Core settings and security
│   ├── db/               # Database configuration
│   ├── models/           # SQLAlchemy models
│   ├── schemas/          # Pydantic schemas
│   └── services/         # Business logic services
├── migrations/           # Alembic database migrations
└── tests/                # Backend tests
```

## Development Setup

1. Create a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```
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

## API Endpoints

- **Authentication**
  - `POST /api/v1/auth/login` - Get JWT token
  - `POST /api/v1/auth/register` - Register new user

- **Projects**
  - `GET /api/v1/projects/` - List projects
  - `POST /api/v1/projects/` - Create project
  - `GET /api/v1/projects/{id}` - Get project details
  - `PUT /api/v1/projects/{id}` - Update project
  - `DELETE /api/v1/projects/{id}` - Delete project

- **Maps**
  - `GET /api/v1/maps/?project_id={project_id}` - List maps for a project
  - `POST /api/v1/maps/` - Upload new map
  - `GET /api/v1/maps/{id}` - Get map details
  - `PUT /api/v1/maps/{id}` - Update map
  - `DELETE /api/v1/maps/{id}` - Delete map

- **Events**
  - `GET /api/v1/events/?project_id={project_id}` - List events
  - `POST /api/v1/events/` - Create event
  - `GET /api/v1/events/{id}` - Get event details
  - `PUT /api/v1/events/{id}` - Update event
  - `DELETE /api/v1/events/{id}` - Delete event
  - `GET /api/v1/events/export?project_id={project_id}` - Export events to CSV/Excel 