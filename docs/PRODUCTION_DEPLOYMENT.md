# Production Deployment Guide

This guide provides detailed instructions for deploying the Servitec Map application to production environments. There are multiple deployment options available based on your infrastructure needs.

## Deployment Options

### 1. Docker Compose Deployment

For single-server deployments, Docker Compose provides a simple way to run the entire stack.

#### Prerequisites

- Docker and Docker Compose installed
- Server with at least 2GB RAM and 1 CPU core
- Domain name with DNS configured to point to your server

#### Steps

1. Clone the repository to your production server:
   ```
   git clone https://github.com/your-organization/servitec-map.git
   cd servitec-map
   ```

2. Create a production environment file:
   ```
   cp backend/.env.example backend/.env.production
   ```

3. Edit the production environment file with your configuration:
   ```
   # Database
   DATABASE_URL=postgresql://postgres:secure_password@postgres:5432/servitec_map
   
   # Security
   SECRET_KEY=your_secure_random_key
   ACCESS_TOKEN_EXPIRE_MINUTES=11520
   
   # CORS
   CORS_ORIGINS=https://your-domain.com
   
   # Storage
   UPLOAD_FOLDER=/app/uploads
   
   # Monitoring
   LOG_LEVEL=INFO
   LOG_PATH=/app/logs
   SLOW_QUERY_THRESHOLD=0.5
   
   # Environment
   ENVIRONMENT=production
   DEBUG=false
   ```

4. Start the production services:
   ```
   docker-compose -f docker-compose.prod.yml up -d
   ```

5. Configure a reverse proxy (Nginx or Traefik) to handle HTTPS. Below is a sample Nginx configuration:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       return 301 https://$host$request_uri;
   }
   
   server {
       listen 443 ssl;
       server_name your-domain.com;
       
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;
       
       # Frontend
       location / {
           proxy_pass http://localhost:80;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
       
       # Backend API
       location /api/ {
           proxy_pass http://localhost:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

6. Set up SSL certificates using Let's Encrypt.

7. Verify the deployment:
   - Access the frontend at `https://your-domain.com`
   - Check the API documentation at `https://your-domain.com/api/v1/docs`
   - Verify the health check endpoint at `https://your-domain.com/api/v1/health/full`

### 2. Google Cloud Run Deployment

For serverless deployments, Google Cloud Run offers excellent scalability and management features.

#### Prerequisites

- Google Cloud Platform account
- gcloud CLI installed and configured
- Docker installed locally

#### Steps

1. Set up a Cloud SQL PostgreSQL instance:
   - Navigate to Cloud SQL in the GCP Console
   - Create a new PostgreSQL instance (version 15)
   - Configure high availability and automated backups
   - Set up a secure password

2. Create a Cloud Storage bucket for file uploads:
   - Navigate to Cloud Storage in the GCP Console
   - Create a new bucket in the same region as your Cloud Run service
   - Configure appropriate access controls

3. Prepare the backend environment file:
   ```
   cd backend
   cp .env.example .env.production
   ```

4. Edit the `.env.production` file with your cloud configuration:
   ```
   # Database
   DATABASE_URL=postgresql://postgres:secure_password@/servitec_map?host=/cloudsql/PROJECT:REGION:INSTANCE
   DB_POOL_SIZE=10
   DB_POOL_OVERFLOW=20
   
   # Security
   SECRET_KEY=your_secure_random_key
   ACCESS_TOKEN_EXPIRE_MINUTES=11520
   
   # CORS
   CORS_ORIGINS=https://your-domain.com
   
   # Storage
   UPLOAD_FOLDER=/app/uploads
   CLOUD_STORAGE_ENABLED=true
   GCP_PROJECT_ID=your-project-id
   GCP_STORAGE_BUCKET=your-bucket-name
   
   # Monitoring
   LOG_LEVEL=INFO
   LOG_PATH=/app/logs
   SLOW_QUERY_THRESHOLD=0.5
   
   # Environment
   ENVIRONMENT=production
   DEBUG=false
   ```

5. Deploy the backend to Cloud Run:
   ```
   cd backend
   ./deploy_cloud_run.sh
   ```

6. Build and deploy the frontend:
   ```
   cd frontend
   
   # Build the production frontend
   docker build -t gcr.io/your-project-id/servitec-map-ui -f Dockerfile.prod .
   docker push gcr.io/your-project-id/servitec-map-ui
   
   # Deploy to Cloud Run
   gcloud run deploy servitec-map-ui \
     --image gcr.io/your-project-id/servitec-map-ui \
     --platform managed \
     --region your-region \
     --allow-unauthenticated
   ```

7. Set up Cloud Run URLs and configure domain mapping if needed.

## Monitoring & Maintenance

### Health Checks

The application includes health check endpoints to monitor its status:

- **Basic Health Check**: `GET /health`
  - Returns basic health status and application version
  
- **Database Health Check**: `GET /api/v1/health/db`
  - Checks database connectivity and query performance
  
- **Storage Health Check**: `GET /api/v1/health/storage`
  - Verifies storage system functionality
  
- **System Health Check**: `GET /api/v1/health/system`
  - Monitors system resources like CPU, memory, and disk usage
  
- **Full Health Check**: `GET /api/v1/health/full`
  - Comprehensive check of all subsystems

### Prometheus Metrics

The application exposes metrics in Prometheus format:

- **Metrics Endpoint**: `GET /api/v1/metrics`
  - Provides metrics on requests, latency, database queries, and system resources

You can configure a Prometheus server to scrape these metrics and set up Grafana dashboards for visualization.

### Structured Logging

Logs are output in structured JSON format for easier parsing and analysis:

- **Application Logs**: `/app/logs/app.log`
- **Database Logs**: `/app/logs/db_queries.log`

In cloud environments, logs are automatically sent to Cloud Logging.

### Backup Strategy

1. **Database Backups**:
   - Configure automated backups for PostgreSQL
   - For Cloud SQL, enable point-in-time recovery
   
2. **File Backups**:
   - For Cloud Storage, enable versioning and lifecycle policies
   - For server deployments, set up automated backup scripts

## Security Considerations

1. **Authentication**: 
   - Set a strong SECRET_KEY for JWT tokens
   - Configure appropriate token expiration times

2. **Database Security**:
   - Use strong, unique passwords
   - Implement database connection encryption
   - Restrict network access to the database

3. **File Storage**:
   - Configure proper access controls for uploaded files
   - Scan uploaded files for malware when possible

4. **Network Security**:
   - Always use HTTPS in production
   - Configure proper CORS settings
   - Implement rate limiting for API endpoints

5. **Environment Variables**:
   - Never commit production environment files to version control
   - Use secret management systems when possible

## Scaling Considerations

1. **Database Scaling**:
   - Monitor connection pool usage
   - Increase pool size as needed
   - Consider read replicas for heavy read workloads

2. **API Scaling**:
   - Cloud Run automatically scales based on traffic
   - For server deployments, consider load balancing

3. **Storage Scaling**:
   - Cloud Storage scales automatically
   - For server deployments, monitor disk usage

## Troubleshooting

### Common Issues

1. **Database Connection Problems**:
   - Check connection string
   - Verify network connectivity
   - Ensure database user has proper permissions

2. **File Upload Issues**:
   - Verify storage configuration
   - Check directory permissions
   - Confirm service account permissions for cloud storage

3. **Performance Problems**:
   - Check slow query logs
   - Monitor system resources
   - Review Prometheus metrics

### Useful Commands

Database migrations:
```
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

Check logs:
```
docker-compose -f docker-compose.prod.yml logs -f backend
```

Restart services:
```
docker-compose -f docker-compose.prod.yml restart backend
``` 