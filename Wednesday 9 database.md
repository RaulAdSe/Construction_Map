# Wednesday April 9 - Database Configuration Documentation

## Overview

This document details the current database configuration for the Servitec Map application, how we successfully connected Cloud Run to Cloud SQL PostgreSQL, and the various methods tested.

## Current Configuration

### PostgreSQL Instance Details

| Property | Value |
|----------|-------|
| Instance Name | `map-view-servitec` |
| Connection Name | `deep-responder-444017-h2:us-central1:map-view-servitec` |
| Internal IP | `172.24.48.3` |
| Port | `5432` |
| Database Name | `servitec_map` |
| Username | `postgres` |
| Network | `servitec-map-network` |
| Region | `us-central1` |

### Working Connection Details

After testing multiple approaches, we confirmed that the **Cloud SQL Auth Proxy** method works successfully. The VPC connector approach times out when trying to connect directly to the database's IP address.

```json
{
  "status": "success",
  "message": "Database connection successful using cloud-sql-proxy",
  "data": {
    "time": "2025-04-09T16:22:53.922Z"
  },
  "allResults": [
    {
      "success": false,
      "method": "vpc-connector",
      "error": {
        "message": "connect ETIMEDOUT 172.24.48.3:5432",
        "detail": "No additional details"
      }
    },
    {
      "success": true,
      "method": "cloud-sql-proxy",
      "data": {
        "time": "2025-04-09T16:22:53.922Z"
      },
      "message": "Connection successful"
    }
  ]
}
```

## Solution Implementation

### Cloud Run Service Configuration

The service was deployed with the following key configurations:

1. **Cloud SQL Auth Proxy Integration**:
   - Used `--add-cloudsql-instances=${INSTANCE_CONNECTION_NAME}` flag
   - Set `DB_SOCKET_PATH=/cloudsql` environment variable
   - Used Unix socket path in the connection string: `/cloudsql/deep-responder-444017-h2:us-central1:map-view-servitec`

2. **VPC Connector**:
   - Also included a VPC connector for testing: `cloud-sql-connector`
   - Set direct IP connection configuration with `DB_HOST=172.24.48.3`
   - This method didn't work due to connectivity timeouts

### Connection Methods Tested

1. **VPC Connector Direct IP Connection**:
   - Uses a serverless VPC connector to connect to the Cloud SQL instance's internal IP
   - Connection configuration:
     ```json
     {
       "user": "postgres",
       "password": "postgres",
       "database": "servitec_map",
       "host": "172.24.48.3",
       "port": "5432"
     }
     ```
   - Status: ❌ Failed with timeout error

2. **Cloud SQL Auth Proxy with Unix Socket**:
   - Uses the official Google Cloud SQL Auth Proxy (automatically managed by Cloud Run)
   - Connection configuration:
     ```json
     {
       "user": "postgres",
       "password": "postgres",
       "database": "servitec_map",
       "host": "/cloudsql/deep-responder-444017-h2:us-central1:map-view-servitec"
     }
     ```
   - Status: ✅ Successful connection

## Scripts Created

We created three different scripts to test different deployment approaches:

### 1. `minimal_deploy.sh`

A script that focuses solely on the VPC connector approach:
- Creates a minimal Node.js app with database connectivity
- Uses the Docker buildx command to build for linux/amd64 architecture
- Deploys to Cloud Run with a VPC connector
- Tests the connection to the database via direct IP

### 2. `minimal_deploy_sql_proxy.sh`

A script that focuses solely on the Cloud SQL Auth Proxy approach:
- Creates a minimal Node.js app with database connectivity via Unix sockets
- Uses the Docker buildx command to build for linux/amd64 architecture
- Deploys to Cloud Run with Cloud SQL Auth Proxy integration
- Tests the connection to the database via Unix socket

### 3. `deploy_smart.sh` (Recommended)

A comprehensive script that implements both connection approaches and automatically detects which one works:
- Creates a smart Node.js application that attempts both connection methods
- Uses Docker buildx to build for linux/amd64 architecture (resolving Apple Silicon build issues)
- Deploys to Cloud Run with both VPC connector and Cloud SQL Auth Proxy
- Tests both connection methods and reports which one succeeds
- Provides detailed debugging information via `/debug` endpoint

The `deploy_smart.sh` script was the most successful, clearly showing that:
- The Cloud SQL Auth Proxy method works successfully
- The VPC connector direct IP method times out

## Environment Variables

The deployed service includes these environment variables:

| Variable | Value | Purpose |
|----------|-------|---------|
| `DB_SOCKET_PATH` | `/cloudsql` | Base path for Unix socket connections |
| `INSTANCE_CONNECTION_NAME` | `deep-responder-444017-h2:us-central1:map-view-servitec` | Cloud SQL instance identifier |
| `DB_HOST` | `172.24.48.3` | Internal IP of PostgreSQL instance |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `postgres` | Database username |
| `DB_PASSWORD` | `postgres` | Database password (hidden) |
| `DB_NAME` | `servitec_map` | Target database name |

## Troubleshooting Process

1. **Architecture Compatibility Issue**: 
   - Initial builds failed because Docker images were being built for Apple Silicon (arm64) architecture
   - Solution: Used `docker buildx` with `--platform linux/amd64` to build compatible images

2. **Connection Method Testing**:
   - Created a smart application that tests both connection methods
   - Found that Cloud SQL Auth Proxy works but VPC connector times out
   - Used detailed logging to identify exactly which connection method succeeded

3. **VPC Network Issues**:
   - Some VPC connectors were in ERROR state (`servitec-map-connector`, `sql-default-connector`)
   - Used working connectors (`cloud-sql-connector`, `cloudrun-sql-connector`)
   - The VPC approach still failed despite using working connectors

## Conclusion and Recommendations

Based on our testing, the Cloud SQL Auth Proxy method is the recommended approach for connecting to the PostgreSQL instance. This approach:

1. Is more secure (handles authentication automatically)
2. Is more reliable (works consistently)
3. Doesn't require managing VPC connectors
4. Leverages Google's official and recommended approach

For future deployments, use the following deployment flags:
```bash
gcloud run deploy SERVICE_NAME \
  --image=IMAGE_NAME \
  --platform=managed \
  --region=us-central1 \
  --allow-unauthenticated \
  --add-cloudsql-instances=deep-responder-444017-h2:us-central1:map-view-servitec \
  --set-env-vars=DB_SOCKET_PATH=/cloudsql,INSTANCE_CONNECTION_NAME=deep-responder-444017-h2:us-central1:map-view-servitec,DB_USER=postgres,DB_PASSWORD=postgres,DB_NAME=servitec_map
```

In your application code, use this connection configuration:
```javascript
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: `${process.env.DB_SOCKET_PATH}/${process.env.INSTANCE_CONNECTION_NAME}`,
};
```

## Service Endpoints

The deployed service is available at: 
- `https://servitec-map-api-smart-ypzdt6srya-uc.a.run.app`

With the following endpoints:
- `/health` - Basic health check endpoint
- `/debug` - Shows environment variables and connection configurations
- `/db-test` - Tests database connectivity with both methods

You can monitor the service logs with:
```bash
gcloud run services logs read servitec-map-api-smart --region=us-central1 --limit=50
``` 