# Servitec Construction Map Application

A comprehensive web application for monitoring construction sites and events on a map interface.

## Architecture

The application consists of:

- **Frontend**: React-based single-page application
- **Backend**: FastAPI-based REST API
- **Database**: PostgreSQL for data storage
- **Storage**: Local file storage with Google Cloud Storage option for production

## Development Setup

### Prerequisites

- Docker and Docker Compose
- Git

### Local Development

1. Clone the repository:
   ```
   git clone https://github.com/your-organization/servitec-map.git
   cd servitec-map
   ```

2. Create a `.env` file in the backend directory:
   ```
   cp backend/.env.example backend/.env
   ```

3. Start the development environment:
   ```
   docker-compose up -d
   ```

4. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

5. Stop the development environment:
   ```
   docker-compose down
   ```

### Development Commands

- Run backend tests:
  ```
  docker-compose exec backend pytest
  ```

- Apply database migrations:
  ```
  docker-compose exec backend alembic upgrade head
  ```

- Create a new migration:
  ```
  docker-compose exec backend alembic revision --autogenerate -m "description"
  ```

## Production Deployment

The application includes comprehensive production deployment options with monitoring capabilities. 

For detailed instructions, see the [Production Deployment Guide](docs/PRODUCTION_DEPLOYMENT.md).

### Key Features

- **Docker Compose Deployment**: For single-server deployments
- **Cloud Run Deployment**: For serverless deployments on GCP
- **Health Checks**: Multiple endpoints for monitoring application health
- **Metrics Collection**: Prometheus metrics for request, database, and system monitoring
- **Structured Logging**: JSON-formatted logs for better analysis
- **Connection Pooling**: Optimized database connections for better performance

### Quick Production Start

1. Create production environment file:
   ```
   cp backend/.env.example backend/.env.production
   ```

2. Edit production configuration for your environment.

3. Start production deployment:
   ```
   docker-compose -f docker-compose.prod.yml up -d
   ```

## Monitoring and Maintenance

The application includes built-in observability features:

### Health Checks

The application includes built-in health check endpoints:
- `/health`: Basic health check
- `/api/v1/health/full`: Comprehensive health check with database status

### Prometheus Metrics

Metrics are exposed at:
- `/api/v1/metrics`: Prometheus-compatible metrics endpoint

### Logs

The application uses structured logging with the following paths:
- Application logs: `/app/logs/app.log`
- Database query logs: `/app/logs/db_queries.log`

## Configuration Options

### Environment Variables

#### Backend

| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | postgresql://postgres:postgres@postgres:5432/servitec_map |
| SECRET_KEY | JWT secret key | development_key |
| CORS_ORIGINS | Allowed CORS origins | http://localhost:3000,http://127.0.0.1:3000 |
| DEBUG | Enable debug mode | false |
| LOG_LEVEL | Logging level | INFO |
| LOG_PATH | Path for log files | /app/logs |
| UPLOAD_FOLDER | Path for file uploads | /app/uploads |
| GCP_STORAGE_BUCKET | GCS bucket name | None |
| GCP_PROJECT_ID | GCP project ID | None |

#### Frontend

| Variable | Description | Default |
|----------|-------------|---------|
| REACT_APP_API_URL | Backend API URL | http://localhost:8000/api/v1 |

## License

This project is proprietary and confidential. 