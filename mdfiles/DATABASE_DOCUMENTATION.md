# Database Documentation

## Overview

The Construction Map Application uses PostgreSQL as its primary database. This document details the database schema, models, relationships, and key operations.

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Projects Table
```sql
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_id INTEGER REFERENCES users(id)
);
```

### Project_Users Table (Junction)
```sql
CREATE TABLE project_users (
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    PRIMARY KEY (project_id, user_id)
);
```

### Maps Table
```sql
CREATE TABLE maps (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_id INTEGER REFERENCES users(id)
);
```

### Events Table
```sql
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    map_id INTEGER REFERENCES maps(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    x_coordinate FLOAT NOT NULL,
    y_coordinate FLOAT NOT NULL,
    status VARCHAR(50) NOT NULL,
    priority VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by_id INTEGER REFERENCES users(id),
    tags TEXT[]
);
```

### Comments Table
```sql
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Notifications Table
```sql
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reference_id INTEGER,
    reference_type VARCHAR(50)
);
```

### Files Table
```sql
CREATE TABLE files (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    uploaded_by_id INTEGER REFERENCES users(id)
);
```

## SQLAlchemy Models

### User Model
```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    full_name = Column(String)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    projects = relationship("Project", secondary="project_users", back_populates="users")
    created_projects = relationship("Project", back_populates="created_by")
```

### Project Model
```python
class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by_id = Column(Integer, ForeignKey("users.id"))
    
    # Relationships
    users = relationship("User", secondary="project_users", back_populates="projects")
    created_by = relationship("User", back_populates="created_projects")
    maps = relationship("Map", back_populates="project", cascade="all, delete-orphan")
```

## Key Database Operations

### User Management
```python
# Create user
def create_user(db: Session, user: UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = User(
        email=user.email,
        hashed_password=hashed_password,
        full_name=user.full_name
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# Get user by email
def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()
```

### Project Operations
```python
# Create project
def create_project(db: Session, project: ProjectCreate, user_id: int):
    db_project = Project(
        name=project.name,
        description=project.description,
        created_by_id=user_id
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

# Add user to project
def add_user_to_project(db: Session, project_id: int, user_id: int, role: str):
    project_user = ProjectUser(
        project_id=project_id,
        user_id=user_id,
        role=role
    )
    db.add(project_user)
    db.commit()
```

## Database Migrations

### Migration Management
- Using Alembic for database migrations
- Version control for schema changes
- Upgrade and downgrade paths

### Example Migration
```python
"""add_tags_to_events

Revision ID: abc123def456
Revises: previous_revision_id
Create Date: 2024-01-01 12:00:00.000000
"""

def upgrade():
    op.add_column('events', sa.Column('tags', sa.ARRAY(sa.String()), nullable=True))

def downgrade():
    op.drop_column('events', 'tags')
```

## Indexes and Performance

### Key Indexes
```sql
CREATE INDEX idx_project_users_project_id ON project_users(project_id);
CREATE INDEX idx_project_users_user_id ON project_users(user_id);
CREATE INDEX idx_events_map_id ON events(map_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_files_event_id ON files(event_id);
```

### Query Optimization
- Use of JOIN operations
- Eager loading relationships
- Pagination implementation
- Caching strategies

## Data Integrity

### Foreign Key Constraints
- ON DELETE CASCADE where appropriate
- Referential integrity enforcement
- Null constraints

### Validation Rules
- Email format validation
- Required fields
- Status enums
- Role restrictions

## Backup and Recovery

### Backup Strategy
- Daily full backups
- Transaction log backups
- Point-in-time recovery capability

### Recovery Procedures
1. Stop application
2. Restore database
3. Apply transaction logs
4. Verify data integrity
5. Restart application

## Security Measures

### Access Control
- Role-based access
- Row-level security
- Password hashing
- Session management

### Data Protection
- Encrypted connections
- Secure password storage
- Audit logging
- Input sanitization

## Common Queries

### Project Access
```sql
SELECT p.* 
FROM projects p
JOIN project_users pu ON p.id = pu.project_id
WHERE pu.user_id = :user_id;
```

### Event Notifications
```sql
SELECT n.* 
FROM notifications n
WHERE n.user_id = :user_id 
AND n.read = false
ORDER BY n.created_at DESC;
```

### Map Events
```sql
SELECT e.* 
FROM events e
JOIN maps m ON e.map_id = m.id
WHERE m.project_id = :project_id;
```

## Troubleshooting

### Common Issues
1. Connection pool exhaustion
2. Lock contention
3. Query performance
4. Disk space management

### Monitoring Queries
```sql
-- Active queries
SELECT pid, query, query_start
FROM pg_stat_activity
WHERE state = 'active';

-- Table sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
``` 