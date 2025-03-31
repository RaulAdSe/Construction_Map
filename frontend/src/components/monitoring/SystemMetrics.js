import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Badge, Spinner } from 'react-bootstrap';
import { getSystemMetrics } from '../../services/monitoringService';

const MetricCard = ({ title, value, unit, icon, variant }) => (
  <Card className="mb-3">
    <Card.Body>
      <div className="d-flex justify-content-between align-items-center">
        <div>
          <h6 className="text-muted mb-1">{title}</h6>
          <h3 className="mb-0">
            {value} <small className="text-muted">{unit}</small>
          </h3>
        </div>
        <div>
          <Badge bg={variant} style={{ fontSize: '1rem', padding: '0.5rem' }}>
            {icon}
          </Badge>
        </div>
      </div>
    </Card.Body>
  </Card>
);

const SystemMetrics = () => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await getSystemMetrics();
      setMetrics(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError('Failed to fetch system metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    // Refresh metrics every 15 seconds
    const interval = setInterval(fetchMetrics, 15000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading && !metrics) {
    return (
      <div className="text-center my-5">
        <Spinner animation="border" />
        <p className="mt-3">Loading system metrics...</p>
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  if (!metrics) {
    return <div className="alert alert-warning">No metrics data available.</div>;
  }

  return (
    <div className="system-metrics">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3>System Metrics</h3>
        {lastUpdated && (
          <small className="text-muted">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </small>
        )}
      </div>
      
      <Row>
        <Col md={4} sm={6}>
          <MetricCard
            title="CPU Usage"
            value={metrics.cpu_usage?.toFixed(1)}
            unit="%"
            icon="CPU"
            variant={metrics.cpu_usage > 80 ? "danger" : metrics.cpu_usage > 60 ? "warning" : "success"}
          />
        </Col>
        <Col md={4} sm={6}>
          <MetricCard
            title="Memory Usage"
            value={metrics.memory_usage?.toFixed(1)}
            unit="%"
            icon="RAM"
            variant={metrics.memory_usage > 80 ? "danger" : metrics.memory_usage > 60 ? "warning" : "success"}
          />
        </Col>
        <Col md={4} sm={6}>
          <MetricCard
            title="Disk Usage"
            value={metrics.disk_usage?.toFixed(1)}
            unit="%"
            icon="HDD"
            variant={metrics.disk_usage > 80 ? "danger" : metrics.disk_usage > 60 ? "warning" : "success"}
          />
        </Col>
        <Col md={4} sm={6}>
          <MetricCard
            title="API Requests"
            value={metrics.api_requests || 0}
            unit="req/min"
            icon="API"
            variant="info"
          />
        </Col>
        <Col md={4} sm={6}>
          <MetricCard
            title="Error Rate"
            value={(metrics.error_rate || 0).toFixed(2)}
            unit="%"
            icon="ERR"
            variant={metrics.error_rate > 5 ? "danger" : metrics.error_rate > 1 ? "warning" : "success"}
          />
        </Col>
        <Col md={4} sm={6}>
          <MetricCard
            title="Active Users"
            value={metrics.active_users || 0}
            unit="users"
            icon="USR"
            variant="primary"
          />
        </Col>
      </Row>
    </div>
  );
};

export default SystemMetrics; 