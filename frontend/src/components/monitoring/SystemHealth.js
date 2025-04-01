import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Alert, ProgressBar } from 'react-bootstrap';
import { getSystemHealth, getDatabaseHealth } from '../../services/monitoringService';

const SystemHealth = () => {
  const [systemHealth, setSystemHealth] = useState(null);
  const [dbHealth, setDbHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dbError, setDbError] = useState(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get system health data
        const systemData = await getSystemHealth();
        setSystemHealth(systemData);
        
        // Try to get database health data
        await fetchDatabaseHealth();
      } catch (err) {
        console.error('Error fetching system health data:', err);
        setError('Failed to fetch system health information.');
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
    
    // Refresh health data every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchDatabaseHealth = async () => {
    try {
      setDbHealth(await getDatabaseHealth());
      setDbError(null);
    } catch (error) {
      console.error('Error fetching DB health:', error);
      setDbError('Database connection issue');
      // Set a default status so the UI still works
      setDbHealth({
        status: 'error',
        timestamp: new Date().toISOString(),
        response_time_ms: 0,
        slow_queries_count: 0,
        recent_slow_queries: []
      });
    }
  };

  if (loading && !systemHealth) {
    return <Alert variant="info">Loading system health data...</Alert>;
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  const getProgressVariant = (percent) => {
    if (percent < 60) return 'success';
    if (percent < 80) return 'warning';
    return 'danger';
  };

  return (
    <div className="system-health mb-4">
      <h3>System Health</h3>
      
      {systemHealth && (
        <Row>
          <Col md={4}>
            <Card className="mb-3">
              <Card.Header>CPU</Card.Header>
              <Card.Body>
                <div className="d-flex justify-content-between mb-2">
                  <span>Usage:</span>
                  <span>{systemHealth.cpu.usage_percent}%</span>
                </div>
                <ProgressBar 
                  variant={getProgressVariant(systemHealth.cpu.usage_percent)} 
                  now={systemHealth.cpu.usage_percent} 
                />
              </Card.Body>
            </Card>
          </Col>
          
          <Col md={4}>
            <Card className="mb-3">
              <Card.Header>Memory</Card.Header>
              <Card.Body>
                <div className="d-flex justify-content-between mb-2">
                  <span>Usage:</span>
                  <span>{systemHealth.memory.usage_percent}%</span>
                </div>
                <ProgressBar 
                  variant={getProgressVariant(systemHealth.memory.usage_percent)} 
                  now={systemHealth.memory.usage_percent} 
                />
                <div className="text-muted mt-2">
                  Used: {systemHealth.memory.used_gb} GB / {systemHealth.memory.total_gb} GB
                </div>
              </Card.Body>
            </Card>
          </Col>
          
          <Col md={4}>
            <Card className="mb-3">
              <Card.Header>Disk</Card.Header>
              <Card.Body>
                <div className="d-flex justify-content-between mb-2">
                  <span>Usage:</span>
                  <span>{systemHealth.disk.usage_percent}%</span>
                </div>
                <ProgressBar 
                  variant={getProgressVariant(systemHealth.disk.usage_percent)} 
                  now={systemHealth.disk.usage_percent} 
                />
                <div className="text-muted mt-2">
                  Used: {systemHealth.disk.used_gb} GB / {systemHealth.disk.total_gb} GB
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
      
      {dbError ? (
        <Alert variant="warning" className="mb-3">
          <strong>Database Health:</strong> {dbError}
        </Alert>
      ) : dbHealth && (
        <Card className="mb-3">
          <Card.Header>Database Health</Card.Header>
          <Card.Body>
            <Row>
              <Col md={6}>
                <Alert variant={dbHealth.status === "healthy" ? "success" : "warning"} className="mb-0">
                  <strong>Status:</strong> {dbHealth.status}
                  <div className="text-muted">
                    Slow Queries: {dbHealth.slow_queries_count || 0}
                  </div>
                </Alert>
              </Col>
              <Col md={6}>
                <Alert variant="info" className="mb-0">
                  <strong>Query Response Time:</strong> {dbHealth.response_time_ms} ms
                  <div className="text-muted">
                    Last checked: {new Date(dbHealth.timestamp).toLocaleString()}
                  </div>
                </Alert>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default SystemHealth; 