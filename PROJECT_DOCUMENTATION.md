# Construction Map Application - Project Documentation

## Project Overview

The Construction Map Application is a web-based tool for managing construction projects, enabling teams to collaborate through interactive map overlays, event tracking, and real-time notifications. This document provides a comprehensive overview of the project structure and architecture.

## Directory Structure

```
construction-map/
├── frontend/               # React frontend application
├── backend/               # FastAPI backend application
├── uploads/               # Shared file storage directory
├── logs/                  # Application logs
├── docker-compose.yml     # Docker configuration
├── start_servers.sh       # Server startup script
└── stop_servers.sh        # Server shutdown script
```

## Backend Structure

```
backend/
├── app/                   # Main application package
│   ├── api/              # API endpoints and routing
│   │   └── v1/          # API version 1 endpoints
│   ├── core/            # Core configuration and settings
│   ├── models/          # Database models
│   ├── schemas/         # Pydantic schemas
│   └── services/        # Business logic services
├── migrations/           # Database migrations
├── tests/               # Test suite
├── uploads/             # File storage
│   ├── comments/        # Comment attachments
│   └── events/         # Event attachments
└── requirements.txt     # Python dependencies
```

### Key Backend Components

1. **API Layer (`app/api/`)**
   - Organized by resource type (events, maps, projects, users)
   - RESTful endpoint definitions
   - Request/response handling
   - Authentication and authorization

2. **Models (`app/models/`)**
   - SQLAlchemy ORM models
   - Database schema definitions
   - Relationship mappings
   - Data validation rules

3. **Services (`app/services/`)**
   - Business logic implementation
   - Data processing and manipulation
   - File handling and storage
   - External service integrations

4. **Core (`app/core/`)**
   - Configuration management
   - Security settings
   - Database connection
   - Common utilities

## Frontend Structure

```
frontend/
├── src/
│   ├── components/       # Reusable React components
│   │   ├── monitoring/  # System monitoring components
│   │   └── common/      # Shared UI components
│   ├── pages/           # Page-level components
│   ├── services/        # API service integrations
│   ├── utils/           # Utility functions
│   ├── assets/          # Static assets
│   └── styles/          # CSS and style files
├── public/              # Static public files
└── package.json         # Node.js dependencies
```

### Key Frontend Components

1. **Components (`src/components/`)**
   - **MapViewer**: Main map visualization component
   - **EventManager**: Event creation and management
   - **NotificationBell**: Real-time notifications
   - **RoleSwitcher**: User role management
   - **ProjectList**: Project navigation and management

2. **Services (`src/services/`)**
   - API integration layer
   - Data fetching and caching
   - WebSocket connections
   - File upload handling

3. **Utils (`src/utils/`)**
   - Authentication helpers
   - Permission management
   - Data formatting
   - Common utilities

## Key Features Implementation

### 1. Map Management
- **File Storage**: `uploads/` directory with separate subdirectories for different content types
- **Visualization**: PDF and image support with dynamic scaling
- **Overlay System**: Multiple map layer support with opacity controls

### 2. Event System
- **Creation**: Click-to-create on maps
- **Tracking**: Status and type management
- **Attachments**: File upload support
- **Comments**: Threaded discussions with @mentions

### 3. Notification System
- **Real-time Updates**: WebSocket integration
- **User Mentions**: @mention functionality
- **Event Updates**: Status change notifications
- **Email Integration**: Optional email notifications

### 4. User Management
- **Authentication**: JWT-based auth system
- **Role Management**: Admin/Member role switching
- **Permissions**: Fine-grained access control
- **Project Access**: Project-based permissions

## Development Workflow

1. **Local Development**
   ```bash
   # Start backend
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload

   # Start frontend
   cd frontend
   npm install
   npm start
   ```

2. **Docker Development**
   ```bash
   docker-compose up -d
   ```

## Testing

1. **Backend Tests**
   ```bash
   cd backend
   pytest
   ```

2. **Frontend Tests**
   ```bash
   cd frontend
   npm test
   ```

## Deployment

1. **Prerequisites**
   - PostgreSQL database
   - Python 3.9+
   - Node.js 16+
   - Docker (optional)

2. **Environment Configuration**
   - Backend: `.env` file in backend directory
   - Frontend: Environment variables in build process

3. **Production Setup**
   - SSL/TLS configuration
   - Database backup strategy
   - Monitoring setup
   - Load balancing (if needed)

## Monitoring and Maintenance

1. **Logging**
   - Application logs in `logs/` directory
   - Database query logging
   - User activity tracking
   - Error monitoring

2. **Performance Monitoring**
   - System metrics dashboard
   - Database performance tracking
   - API response times
   - Resource utilization

3. **Backup and Recovery**
   - Database backup procedures
   - File storage backup
   - Recovery protocols
   - Data integrity checks

## Security Considerations

1. **Authentication**
   - JWT token management
   - Session handling
   - Password security

2. **Authorization**
   - Role-based access control
   - Project-level permissions
   - Resource access validation

3. **Data Protection**
   - Input validation
   - SQL injection prevention
   - XSS protection
   - CSRF protection

## Contributing Guidelines

1. **Code Style**
   - PEP 8 for Python
   - ESLint configuration for JavaScript
   - Component organization
   - Documentation requirements

2. **Git Workflow**
   - Branch naming conventions
   - Commit message format
   - Pull request process
   - Code review guidelines

3. **Testing Requirements**
   - Unit test coverage
   - Integration testing
   - End-to-end testing
   - Performance testing

## Troubleshooting

1. **Common Issues**
   - Database connection problems
   - File upload issues
   - Authentication errors
   - Performance bottlenecks

2. **Debug Tools**
   - Backend debugging
   - Frontend DevTools
   - Database query analysis
   - Log analysis

## Future Improvements

1. **Planned Features**
   - Mobile responsiveness
   - Offline support
   - Advanced search capabilities
   - Report generation

2. **Technical Debt**
   - Code optimization opportunities
   - Architecture improvements
   - Testing coverage
   - Documentation updates

## Support and Resources

1. **Documentation**
   - API documentation
   - Component documentation
   - Database schema
   - Deployment guides

2. **Contact**
   - Development team contacts
   - Support channels
   - Issue reporting
   - Feature requests 