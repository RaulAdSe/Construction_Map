# Monitoring and Logging Panel Implementation Plan

This document outlines the detailed plan for implementing a comprehensive monitoring and logging panel for the Construction Map application.

## 1. Architecture Overview

```
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│                   │     │                   │     │                   │
│  Backend API      │     │  Metrics Collector│     │  Monitoring Panel │
│  (FastAPI)        │◄────┤  (Prometheus)     │◄────┤  (React Dashboard)│
│                   │     │                   │     │                   │
└───────┬───────────┘     └───────────────────┘     └───────────────────┘
        │                                                      ▲
        │                                                      │
        │                                                      │
        ▼                                                      │
┌───────────────────┐     ┌───────────────────┐               │
│                   │     │                   │               │
│  Database         │     │  Log Aggregator   │───────────────┘
│  (PostgreSQL)     │     │  (ELK Stack)      │
│                   │     │                   │
└───────────────────┘     └───────────────────┘
```

## 2. Key Components

### 2.1 Backend Monitoring Extensions
- Health check endpoints for all services
- Prometheus metrics exporter
- Structured logging with JSON format
- Request tracing middleware
- Performance metrics collection
- Database query monitoring

### 2.2 Metrics Collection
- Prometheus server for metrics collection
- Node exporter for host metrics
- PostgreSQL exporter for database metrics
- Custom application metrics

### 2.3 Log Aggregation
- Elasticsearch for log storage and indexing
- Logstash for log processing and enrichment
- Kibana for log visualization and search
- Filebeat for log shipping

### 2.4 Monitoring Dashboard
- React-based admin dashboard
- Real-time metrics visualization
- Interactive charts and graphs
- System health overview
- Alert management interface
- User activity tracking

## 3. Implementation Details

### 3.1 Backend API Extensions

#### Health Check Endpoints
```python
@app.get("/api/v1/health")
async def health_check():
    """Basic health check endpoint."""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

@app.get("/api/v1/health/db")
async def db_health_check(db: Session = Depends(get_db)):
    """Database health check endpoint."""
    try:
        # Execute a simple query to check database connection
        result = db.execute("SELECT 1").scalar()
        return {
            "status": "ok",
            "timestamp": datetime.now().isoformat(),
            "database": settings.POSTGRES_DB,
            "result": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Database health check failed: {str(e)}"
        )
```

#### Structured Logging Middleware
```python
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Middleware to log all requests with structured data."""
    request_id = str(uuid.uuid4())
    start_time = time.time()
    
    # Add request_id to request state
    request.state.request_id = request_id
    
    # Process the request
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Log successful request
        logger.info(
            "Request completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration": process_time,
                "user_agent": request.headers.get("user-agent"),
            }
        )
        
        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id
        return response
    except Exception as e:
        # Log failed request
        logger.error(
            "Request failed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "error": str(e),
                "user_agent": request.headers.get("user-agent"),
            }
        )
        raise
```

#### Prometheus Metrics
```python
from prometheus_client import Counter, Histogram, start_http_server

# Define metrics
REQUEST_COUNT = Counter(
    "app_request_count",
    "Application Request Count",
    ["method", "endpoint", "status"]
)

REQUEST_LATENCY = Histogram(
    "app_request_latency_seconds",
    "Application Request Latency",
    ["method", "endpoint"]
)

DATABASE_QUERY_COUNT = Counter(
    "app_database_query_count",
    "Database Query Count",
    ["operation", "table"]
)

DATABASE_QUERY_LATENCY = Histogram(
    "app_database_query_latency_seconds",
    "Database Query Latency",
    ["operation", "table"]
)

# Start metrics server
def start_metrics_server():
    start_http_server(8001)
```

### 3.2 Database Monitoring

#### Query Performance Tracking
```python
from sqlalchemy import event
from sqlalchemy.engine import Engine
import time

@event.listens_for(Engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info.setdefault('query_start_time', []).append(time.time())

@event.listens_for(Engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    start_time = conn.info['query_start_time'].pop()
    total_time = time.time() - start_time
    
    # Extract table name from the query
    table = "unknown"
    if " FROM " in statement:
        table = statement.split(" FROM ")[1].split(" ")[0].strip()
    
    # Determine operation type
    operation = "unknown"
    if statement.startswith("SELECT"):
        operation = "select"
    elif statement.startswith("INSERT"):
        operation = "insert"
    elif statement.startswith("UPDATE"):
        operation = "update"
    elif statement.startswith("DELETE"):
        operation = "delete"
    
    # Record metrics
    DATABASE_QUERY_COUNT.labels(operation=operation, table=table).inc()
    DATABASE_QUERY_LATENCY.labels(operation=operation, table=table).observe(total_time)
    
    # Log slow queries
    if total_time > 0.5:  # Log queries taking more than 500ms
        logger.warning(
            "Slow query detected",
            extra={
                "query": statement,
                "duration": total_time,
                "table": table,
                "operation": operation
            }
        )
```

### 3.3 Frontend Monitoring Dashboard

#### Dashboard Structure
```
/monitoring/
├── components/
│   ├── SystemHealth.jsx
│   ├── MetricsChart.jsx
│   ├── LogViewer.jsx
│   ├── AlertsPanel.jsx
│   ├── DatabaseStats.jsx
│   └── UserActivity.jsx
├── services/
│   ├── metricsService.js
│   ├── logsService.js
│   └── alertsService.js
├── pages/
│   ├── Dashboard.jsx
│   ├── SystemMetrics.jsx
│   ├── LogExplorer.jsx
│   ├── DatabaseMonitor.jsx
│   └── Settings.jsx
└── utils/
    ├── chartHelpers.js
    └── formatters.js
```

#### Main Dashboard Page
```jsx
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { fetchSystemHealth, fetchRecentMetrics } from '../services/metricsService';
import { fetchRecentAlerts } from '../services/alertsService';
import { fetchRecentLogs } from '../services/logsService';
import SystemHealth from '../components/SystemHealth';
import MetricsChart from '../components/MetricsChart';
import AlertsPanel from '../components/AlertsPanel';
import LogViewer from '../components/LogViewer';

const Dashboard = () => {
  const [health, setHealth] = useState({});
  const [metrics, setMetrics] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [healthData, metricsData, alertsData, logsData] = await Promise.all([
          fetchSystemHealth(),
          fetchRecentMetrics(),
          fetchRecentAlerts(),
          fetchRecentLogs({ limit: 10 })
        ]);
        
        setHealth(healthData);
        setMetrics(metricsData);
        setAlerts(alertsData);
        setLogs(logsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Set up refresh interval
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  if (loading) {
    return <div>Loading dashboard data...</div>;
  }
  
  return (
    <Container fluid>
      <h1>System Monitoring Dashboard</h1>
      
      <Row className="mb-4">
        <Col>
          <SystemHealth data={health} />
        </Col>
      </Row>
      
      <Row className="mb-4">
        <Col md={8}>
          <Card>
            <Card.Header>System Metrics</Card.Header>
            <Card.Body>
              <MetricsChart data={metrics} />
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <AlertsPanel alerts={alerts} />
        </Col>
      </Row>
      
      <Row>
        <Col>
          <Card>
            <Card.Header>Recent Logs</Card.Header>
            <Card.Body>
              <LogViewer logs={logs} />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Dashboard;
```

### 3.4 API Integration Services

#### Metrics Service
```javascript
// metricsService.js
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const fetchSystemHealth = async () => {
  const response = await axios.get(`${API_URL}/api/v1/health`);
  return response.data;
};

export const fetchDatabaseHealth = async () => {
  const response = await axios.get(`${API_URL}/api/v1/health/db`);
  return response.data;
};

export const fetchRecentMetrics = async (params = {}) => {
  const { startTime, endTime, metrics = ['cpu', 'memory', 'requests'] } = params;
  
  const queryParams = new URLSearchParams();
  
  if (startTime) queryParams.append('startTime', startTime);
  if (endTime) queryParams.append('endTime', endTime);
  if (metrics) queryParams.append('metrics', metrics.join(','));
  
  const response = await axios.get(`${API_URL}/api/v1/metrics?${queryParams}`);
  return response.data;
};

export const fetchMetricsHistory = async (metric, params = {}) => {
  const { startTime, endTime, resolution = '1m' } = params;
  
  const queryParams = new URLSearchParams();
  
  if (startTime) queryParams.append('startTime', startTime);
  if (endTime) queryParams.append('endTime', endTime);
  queryParams.append('resolution', resolution);
  
  const response = await axios.get(`${API_URL}/api/v1/metrics/${metric}/history?${queryParams}`);
  return response.data;
};
```

#### Logs Service
```javascript
// logsService.js
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const fetchRecentLogs = async (params = {}) => {
  const { limit = 100, level, search, startTime, endTime } = params;
  
  const queryParams = new URLSearchParams();
  
  queryParams.append('limit', limit);
  if (level) queryParams.append('level', level);
  if (search) queryParams.append('search', search);
  if (startTime) queryParams.append('startTime', startTime);
  if (endTime) queryParams.append('endTime', endTime);
  
  const response = await axios.get(`${API_URL}/api/v1/logs?${queryParams}`);
  return response.data;
};

export const searchLogs = async (searchTerm, params = {}) => {
  const { limit = 100, startTime, endTime, levels = [] } = params;
  
  const queryParams = new URLSearchParams();
  
  queryParams.append('search', searchTerm);
  queryParams.append('limit', limit);
  if (startTime) queryParams.append('startTime', startTime);
  if (endTime) queryParams.append('endTime', endTime);
  if (levels.length > 0) queryParams.append('levels', levels.join(','));
  
  const response = await axios.get(`${API_URL}/api/v1/logs/search?${queryParams}`);
  return response.data;
};
```

## 4. Deployment Configuration

### 4.1 Docker-Compose Extension for Monitoring Stack
```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    restart: unless-stopped
    
  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    restart: unless-stopped
    depends_on:
      - prometheus
      
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.9.0
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    environment:
      - discovery.type=single-node
      - ES_JAVA_OPTS=-Xms512m -Xmx512m
    ports:
      - "9200:9200"
    restart: unless-stopped
    
  logstash:
    image: docker.elastic.co/logstash/logstash:8.9.0
    volumes:
      - ./monitoring/logstash/pipeline:/usr/share/logstash/pipeline
      - ./monitoring/logstash/config/logstash.yml:/usr/share/logstash/config/logstash.yml
    ports:
      - "5044:5044"
    depends_on:
      - elasticsearch
    restart: unless-stopped
    
  kibana:
    image: docker.elastic.co/kibana/kibana:8.9.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch
    restart: unless-stopped
    
  filebeat:
    image: docker.elastic.co/beats/filebeat:8.9.0
    volumes:
      - ./monitoring/filebeat/filebeat.yml:/usr/share/filebeat/filebeat.yml:ro
      - ./logs:/logs:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    depends_on:
      - logstash
    restart: unless-stopped
    
volumes:
  prometheus_data:
  grafana_data:
  elasticsearch_data:
```

### 4.2 Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'backend'
    static_configs:
      - targets: ['backend:8001']

  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
```

### 4.3 Grafana Dashboards
We'll configure the following Grafana dashboards:
- System Overview Dashboard
- API Performance Dashboard
- Database Performance Dashboard
- User Activity Dashboard
- Error Tracking Dashboard

## 5. Implementation Timeline

### Week 1: Design and Planning
- Finalize technical requirements
- Define metrics to collect
- Design dashboard layouts
- Create API specifications for monitoring endpoints

### Week 2: Backend Implementation (Part 1)
- Set up structured logging
- Implement health check endpoints
- Create Prometheus metrics integration
- Configure database query monitoring

### Week 3: Backend Implementation (Part 2)
- Implement log aggregation with ELK stack
- Create log search and filtering API
- Develop user activity tracking
- Set up alert triggers and notifications

### Week 4: Frontend Implementation (Part 1)
- Create dashboard layout and navigation
- Implement system health overview
- Build metrics visualization components
- Develop real-time updating charts

### Week 5: Frontend Implementation (Part 2)
- Build log viewer and search interface
- Implement database monitoring dashboard
- Create user activity tracking views
- Develop alert management interface

### Week 6: Testing and Documentation
- Complete end-to-end testing
- Write documentation for the monitoring system
- Create runbooks for common issues
- Prepare user guides for the monitoring dashboard

## 6. Key Features

### 6.1 Real-time System Health Monitoring
- CPU, memory, and disk usage metrics
- API response times and error rates
- Database performance metrics
- Request volume and throughput

### 6.2 Advanced Log Management
- Centralized log collection
- Full-text search capabilities
- Log level filtering
- Context-aware log exploration
- Log correlation with requests

### 6.3 Database Performance Insights
- Query performance monitoring
- Slow query identification
- Connection pool usage
- Table growth tracking
- Index usage statistics

### 6.4 User Activity Monitoring
- Login/logout events
- Resource access tracking
- Action auditing
- User session analytics
- Error tracking by user

### 6.5 Alerting and Notifications
- Threshold-based alerts
- Anomaly detection
- Alert escalation policies
- Notification via email, Slack, etc.
- Alert history and resolution tracking 