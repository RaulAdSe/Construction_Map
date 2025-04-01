# Construction Map Application

A comprehensive web application for construction project management that enables real-time collaboration through interactive map overlays, event tracking, and team communication.

## Core Features

### Map Management
- Multi-layer map visualization with opacity controls
- Support for PDF and image-based maps (JPG, PNG, SVG)
- Dynamic map overlay system
- Intelligent content scaling and positioning

### Event Management
- Create and track events/issues on specific map locations
- Rich event details with status tracking
- File attachments and image support
- Event categorization with dynamic tags
- Event filtering and search capabilities

### Team Collaboration
- Real-time notifications system
- @mention functionality in comments and descriptions
- Comment threads on events with file attachments
- User role management (Admin/Member)
- Project-based access control

### Project Administration
- Project creation and management
- Team member management
- Map layer configuration
- Export capabilities for project data

## Tech Stack

### Backend
- Python 3.9+
- FastAPI framework
- PostgreSQL 13+
- SQLAlchemy ORM
- Alembic migrations

### Frontend
- React 19
- Bootstrap 5
- React Router v7
- Axios for API communication
- Modern ES6+ JavaScript

## Getting Started

### Prerequisites
- Python 3.9 or higher
- PostgreSQL 13 or higher
- Node.js 16 or higher
- npm or yarn package manager

### Local Development Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-repo/construction-map.git
   cd construction-map
   ```

2. **Backend Setup**
   ```bash
   # Create and activate virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   
   # Install dependencies
   cd backend
   pip install -r requirements.txt
   
   # Configure environment
   cp .env.example .env
   # Edit .env with your database credentials and settings
   
   # Run migrations
   alembic upgrade head
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```

4. **Start Development Servers**
   ```bash
   # Start backend server (from backend directory)
   uvicorn app.main:app --reload --port 8000
   
   # Start frontend server (from frontend directory)
   npm start
   ```

5. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Environment Configuration

Create a `.env` file in the backend directory with the following variables:
```env
# Database
POSTGRES_SERVER=localhost
POSTGRES_USER=your_username
POSTGRES_PASSWORD=your_password
POSTGRES_DB=construction_map

# Security
SECRET_KEY=your_secret_key
ACCESS_TOKEN_EXPIRE_MINUTES=1440  # 24 hours

# File Storage
UPLOAD_FOLDER=./uploads
```

## Project Structure

```
construction-map/
├── backend/
│   ├── app/
│   │   ├── api/          # API endpoints and routing
│   │   ├── core/         # Core configuration
│   │   ├── models/       # Database models
│   │   ├── schemas/      # Pydantic schemas
│   │   └── services/     # Business logic
│   ├── migrations/       # Database migrations
│   └── uploads/          # File storage
└── frontend/
    ├── public/
    └── src/
        ├── components/   # React components
        ├── services/     # API services
        ├── utils/        # Utility functions
        └── assets/       # Static assets
```

## Key Features in Detail

### Notification System
- Real-time notifications for event updates
- @mention functionality in comments
- Notification badge with unread count
- One-click navigation to referenced content

### Map Visualization
- Support for multiple map formats (PDF, JPG, PNG, SVG)
- Layer management with opacity controls
- Consistent scaling across different viewport sizes
- Event marker placement and visualization

### Event Management
- Status tracking (Open, In Progress, Resolved, Closed)
- Category/tag system
- File attachments
- Comment threads
- Location marking on maps

## Development Guidelines

1. **Code Organization**
   - Keep components focused and single-responsibility
   - Use services for API communication
   - Implement proper error handling
   - Follow established naming conventions

2. **State Management**
   - Use React hooks for local state
   - Implement proper data fetching patterns
   - Handle loading and error states

3. **Security**
   - Implement proper authentication checks
   - Validate user permissions
   - Sanitize user inputs
   - Secure file uploads

## Deployment Considerations

The application is ready for deployment with the following considerations:

1. **Database Setup**
   - Configure production PostgreSQL instance
   - Run migrations before deployment
   - Set up regular backups

2. **File Storage**
   - Configure secure file storage system
   - Set up CDN for static files (optional)
   - Implement backup strategy for uploaded files

3. **Security**
   - Configure HTTPS
   - Set up proper CORS policies
   - Implement rate limiting
   - Configure secure session handling

4. **Monitoring**
   - Set up application logging
   - Configure performance monitoring
   - Implement error tracking

## License

This project is licensed under the MIT License. See the LICENSE file for details.

### Docker Setup (For Testing)

The application can be quickly tested using Docker containers. This method doesn't require installing any dependencies locally except Docker and Docker Compose.

1. **Prerequisites**
   - Docker
   - Docker Compose

2. **Quick Start**
   ```bash
   # Clone the repository
   git clone https://github.com/your-repo/construction-map.git
   cd construction-map

   # Start all services
   docker-compose up -d

   # The application will be available at:
   # Frontend: http://localhost:3000
   # Backend API: http://localhost:8000
   # API Documentation: http://localhost:8000/docs
   ```

3. **View Logs**
   ```bash
   # View all logs
   docker-compose logs -f

   # View specific service logs
   docker-compose logs -f backend
   docker-compose logs -f frontend
   docker-compose logs -f db
   ```

4. **Stop the Application**
   ```bash
   docker-compose down
   ```

5. **Reset Everything**
   ```bash
   # This will remove all containers and volumes
   docker-compose down -v
   ```

The Docker setup includes:
- PostgreSQL database
- Backend API with FastAPI
- Frontend React application
- Automatic database migrations
- Persistent storage for uploads and database 