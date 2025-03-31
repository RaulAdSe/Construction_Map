# Construction Map Application Deployment Plan

This document outlines the strategy for deploying the Construction Map application in a scalable, maintainable way.

## 1. Containerization Strategy

### 1.1 Docker Container Setup
- **Backend Container**
  ```dockerfile
  FROM python:3.11-slim
  WORKDIR /app
  COPY backend/requirements.txt .
  RUN pip install --no-cache-dir -r requirements.txt
  COPY backend/ .
  CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
  ```

- **Frontend Container**
  ```dockerfile
  FROM node:20-alpine
  WORKDIR /app
  COPY frontend/package*.json ./
  RUN npm install
  COPY frontend/ .
  RUN npm run build
  
  # Production with Nginx
  FROM nginx:alpine
  COPY --from=0 /app/build /usr/share/nginx/html
  COPY deployment/nginx.conf /etc/nginx/conf.d/default.conf
  EXPOSE 80
  CMD ["nginx", "-g", "daemon off;"]
  ```

- **Database Container** (for local development)
  ```dockerfile
  FROM postgres:15-alpine
  ENV POSTGRES_USER=postgres
  ENV POSTGRES_PASSWORD=postgres
  ENV POSTGRES_DB=construction_map
  VOLUME ["/var/lib/postgresql/data"]
  ```

### 1.2 Docker Compose Setup
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - POSTGRES_SERVER=db
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=construction_map
      - SECRET_KEY=${SECRET_KEY}
      - UPLOAD_FOLDER=/app/uploads
    volumes:
      - uploaded_files:/app/uploads
    depends_on:
      - db
    restart: unless-stopped
    
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
      
  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=construction_map
    restart: unless-stopped
    
volumes:
  postgres_data:
  uploaded_files:
```

## 2. Cloud Deployment Options

### 2.1 Simple VM Deployment (Minimal Infrastructure)
- Single VM on AWS EC2, Azure VM, or GCP Compute Engine
- Run Docker Compose stack directly on the VM
- Use a managed database service instead of containerized PostgreSQL
- Set up automated backups for the database
- Use a domain name with proper SSL certificates

### 2.2 Scalable Kubernetes Deployment
- Use a managed Kubernetes service (EKS, AKS, GKE)
- Deploy separate pods for backend and frontend services
- Use Kubernetes Secrets for environment variables
- Implement horizontal pod autoscaling
- Use Ingress controllers for routing
- Set up persistent volumes for uploaded files

### 2.3 Serverless Option
- Frontend: Deploy to S3/CloudFront or Azure Static Web Apps
- Backend: AWS Lambda with API Gateway or Azure Functions
- Database: Aurora Serverless or Azure SQL Serverless
- File Storage: S3 or Azure Blob Storage

## 3. Database Scaling Strategy

### 3.1 Managed Database Service
- Migrate from containerized PostgreSQL to:
  - AWS RDS for PostgreSQL
  - Azure Database for PostgreSQL
  - Google Cloud SQL for PostgreSQL
- Start with a suitable instance size (e.g., db.t3.medium on AWS)
- Set up automated backups and point-in-time recovery
- Configure high availability with replicas in different zones

### 3.2 Connection Pooling
- Implement PgBouncer for connection pooling
- Configure proper connection limits
- Monitor connection usage

### 3.3 Database Migration Strategy
1. Create database dump from development environment
2. Set up managed database with proper security groups/firewall rules
3. Import data into the managed database
4. Update application configuration to point to the new database
5. Verify application functionality after migration

## 4. Static Assets Management

### 4.1 Move Uploaded Files to Object Storage
- Migrate from local filesystem to:
  - AWS S3
  - Azure Blob Storage
  - Google Cloud Storage
- Update backend services to use cloud storage APIs
- Configure proper access controls and lifecycle policies

### 4.2 CDN Integration
- Set up a CDN (CloudFront, Azure CDN, Cloud CDN) for frontend assets
- Configure CDN for uploaded media files
- Set up proper cache control headers
- Configure CORS as needed

## 5. CI/CD Pipeline

### 5.1 GitHub Actions Workflow
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ master, develop ]
  pull_request:
    branches: [ master, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          
      - name: Install dependencies
        run: |
          cd backend
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          
      - name: Run tests
        run: |
          cd backend
          pytest
        env:
          POSTGRES_SERVER: localhost
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
          
  build-and-deploy:
    needs: test
    if: github.event_name == 'push' && github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
        
      - name: Build and push backend
        uses: docker/build-push-action@v4
        with:
          context: ./backend
          push: true
          tags: your-registry/construction-map-backend:latest
          
      - name: Build and push frontend
        uses: docker/build-push-action@v4
        with:
          context: ./frontend
          push: true
          tags: your-registry/construction-map-frontend:latest
          
      - name: Deploy to server
        # Deploy containers to production server
        # This will vary based on deployment target
```

### 5.2 Automated Testing Strategy
- Unit tests for backend services
- Integration tests for API endpoints
- End-to-end tests for critical workflows
- UI component tests

## 6. Security Enhancements

### 6.1 CORS Configuration
- Properly restrict allowed origins in production
- Update FastAPI CORS middleware with specific allowed origins

### 6.2 HTTPS Implementation
- Obtain SSL certificates (Let's Encrypt or commercial CA)
- Configure proper HTTPS redirects
- Implement HSTS headers
- Configure secure cookies

### 6.3 API Security
- Implement rate limiting for API endpoints
- Add request validation and sanitization
- Use proper HTTP security headers
- Conduct regular security audits

### 6.4 Environment Variables Security
- Use a secrets management service in production
- Avoid storing secrets in code repositories
- Implement rotation policies for credentials

## 7. Monitoring and Logging

### 7.1 Structured Logging
- Implement structured logging with JSON format
- Add contextual information (request ID, user ID)
- Log appropriate levels of detail for different environments

### 7.2 Application Monitoring
- Implement health check endpoints
- Set up application performance monitoring (APM)
- Monitor API response times and error rates
- Set up alerts for critical issues

### 7.3 Database Monitoring
- Monitor database performance metrics
- Set up query performance analysis
- Monitor connection pool usage
- Implement slow query logging

### 7.4 Infrastructure Monitoring
- Monitor host-level metrics (CPU, memory, disk, network)
- Set up log aggregation
- Configure dashboards for key metrics
- Implement automated alerting

## 8. Implementation Phases

### Phase 1: Containerization (2 weeks)
- Create Docker files for all components
- Set up Docker Compose for local development
- Implement CI pipeline for container builds

### Phase 2: Production Configuration (2 weeks)
- Set up production environment variables
- Configure proper CORS and security settings
- Set up HTTPS with proper certificates
- Implement structured logging

### Phase 3: Cloud Infrastructure (3 weeks)
- Set up cloud services (VM or Kubernetes)
- Migrate database to managed service
- Configure object storage for uploaded files
- Set up CDN for static assets

### Phase 4: CI/CD and Monitoring (2 weeks)
- Set up automated deployment pipeline
- Implement application monitoring
- Configure alerts and dashboards
- Document operations procedures

## 9. Estimated Costs

### Minimal Setup (VM-based)
- VM: $20-40/month
- Managed Database: $50-100/month
- Object Storage: $5-20/month
- CDN: $10-30/month
- **Total: $85-190/month**

### Scalable Setup (Kubernetes)
- Kubernetes Cluster: $150-300/month
- Managed Database: $100-200/month
- Object Storage: $20-50/month
- CDN: $20-60/month
- **Total: $290-610/month**

### Serverless Setup
- API Gateway/Functions: $20-80/month (usage-based)
- Serverless Database: $40-120/month
- Object Storage: $10-30/month
- CDN: $10-30/month
- **Total: $80-260/month** (highly dependent on usage)

## 10. Monitoring and Logging Panel Development Plan

For the upcoming branch to implement the monitoring and logging panel:

### Features
- Real-time dashboard for application health
- System metrics visualization
- Error log viewer and search
- User activity monitoring
- Database performance insights
- Automated alerting system

### Tech Stack
- Backend: Extend FastAPI with monitoring endpoints
- Frontend: Create React dashboard with data visualization
- Data Store: Time-series database for metrics
- Integration: ELK Stack or Prometheus/Grafana

### Timeline
- Week 1: Design and architecture
- Week 2-3: Backend implementation
- Week 4-5: Frontend dashboard development
- Week 6: Testing and documentation 