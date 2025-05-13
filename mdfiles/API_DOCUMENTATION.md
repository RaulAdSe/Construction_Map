# Backend API Documentation

## Overview

The backend API is built with FastAPI and provides RESTful endpoints for the Construction Map Application. This document details all available endpoints, their request/response formats, and authentication requirements.

## Authentication

All endpoints except for login and register require JWT authentication.

### Authentication Headers
```
Authorization: Bearer <jwt_token>
```

## API Endpoints

### Authentication

#### POST /api/v1/auth/login
Login with username and password.

Request:
```json
{
  "username": "string",
  "password": "string"
}
```

Response:
```json
{
  "access_token": "string",
  "token_type": "bearer",
  "user": {
    "id": "integer",
    "username": "string",
    "is_admin": "boolean"
  }
}
```

#### POST /api/v1/auth/register
Register a new user.

Request:
```json
{
  "username": "string",
  "password": "string",
  "email": "string"
}
```

### Projects

#### GET /api/v1/projects
Get all projects accessible to the user.

Response:
```json
[
  {
    "id": "integer",
    "name": "string",
    "description": "string",
    "created_at": "datetime",
    "updated_at": "datetime",
    "user_role": "string"
  }
]
```

#### POST /api/v1/projects
Create a new project.

Request:
```json
{
  "name": "string",
  "description": "string"
}
```

#### GET /api/v1/projects/{project_id}
Get project details.

#### PUT /api/v1/projects/{project_id}
Update project details.

#### DELETE /api/v1/projects/{project_id}
Delete a project.

### Maps

#### GET /api/v1/projects/{project_id}/maps
Get all maps in a project.

Response:
```json
[
  {
    "id": "integer",
    "name": "string",
    "file_url": "string",
    "file_type": "string",
    "created_at": "datetime"
  }
]
```

#### POST /api/v1/projects/{project_id}/maps
Upload a new map.

Request:
```
multipart/form-data
- file: File
- name: string
- description: string
```

#### DELETE /api/v1/maps/{map_id}
Delete a map.

### Events

#### GET /api/v1/projects/{project_id}/events
Get all events in a project.

Query Parameters:
- status: string (optional)
- type: string (optional)
- map_id: integer (optional)

Response:
```json
[
  {
    "id": "integer",
    "title": "string",
    "description": "string",
    "status": "string",
    "type": "string",
    "position_x": "float",
    "position_y": "float",
    "created_at": "datetime",
    "created_by": {
      "id": "integer",
      "username": "string"
    }
  }
]
```

#### POST /api/v1/projects/{project_id}/events
Create a new event.

Request:
```json
{
  "title": "string",
  "description": "string",
  "map_id": "integer",
  "position_x": "float",
  "position_y": "float",
  "type": "string"
}
```

#### PUT /api/v1/events/{event_id}
Update an event.

Request:
```json
{
  "title": "string",
  "description": "string",
  "status": "string",
  "type": "string"
}
```

### Comments

#### GET /api/v1/events/{event_id}/comments
Get all comments for an event.

Response:
```json
[
  {
    "id": "integer",
    "content": "string",
    "created_at": "datetime",
    "user": {
      "id": "integer",
      "username": "string"
    },
    "attachments": [
      {
        "id": "integer",
        "file_url": "string",
        "file_type": "string"
      }
    ]
  }
]
```

#### POST /api/v1/events/{event_id}/comments
Add a comment to an event.

Request:
```
multipart/form-data
- content: string
- attachments: File[] (optional)
```

### Users

#### GET /api/v1/projects/{project_id}/users
Get all users in a project.

Response:
```json
[
  {
    "id": "integer",
    "username": "string",
    "role": "string",
    "joined_at": "datetime"
  }
]
```

#### POST /api/v1/projects/{project_id}/users
Add a user to a project.

Request:
```json
{
  "user_id": "integer",
  "role": "string"
}
```

### Notifications

#### GET /api/v1/notifications
Get user notifications.

Query Parameters:
- unread_only: boolean (optional)
- limit: integer (optional)
- offset: integer (optional)

Response:
```json
{
  "total": "integer",
  "notifications": [
    {
      "id": "integer",
      "type": "string",
      "message": "string",
      "read": "boolean",
      "created_at": "datetime",
      "data": {
        "event_id": "integer",
        "comment_id": "integer"
      }
    }
  ]
}
```

#### PUT /api/v1/notifications/{notification_id}/read
Mark a notification as read.

#### PUT /api/v1/notifications/read-all
Mark all notifications as read.

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "detail": "Error message explaining the problem"
}
```

### 401 Unauthorized
```json
{
  "detail": "Could not validate credentials"
}
```

### 403 Forbidden
```json
{
  "detail": "Not enough permissions"
}
```

### 404 Not Found
```json
{
  "detail": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error"
}
```

## Rate Limiting

API endpoints are rate-limited to:
- 100 requests per minute for authenticated users
- 20 requests per minute for unauthenticated users

## Websocket Endpoints

### /ws/notifications
Real-time notification updates.

Connection requires:
- JWT token as query parameter
- Project ID as query parameter

Messages:
```json
{
  "type": "notification",
  "data": {
    "id": "integer",
    "type": "string",
    "message": "string",
    "created_at": "datetime"
  }
}
``` 