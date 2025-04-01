import React, { useState, useEffect } from 'react';
import { Card, Table, Form, InputGroup, Button, Badge, Spinner } from 'react-bootstrap';
import { getLogs } from '../../services/monitoringService';

const LogViewer = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalLogs, setTotalLogs] = useState(0);
  
  // Filter state
  const [filters, setFilters] = useState({
    level: '',
    search: '',
    limit: 100
  });
  
  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await getLogs({
        level: filters.level || undefined,
        search: filters.search || undefined,
        limit: filters.limit
      });
      
      setLogs(result.logs);
      setTotalLogs(result.total);
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError('Failed to fetch application logs.');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchLogs();
    
    // Refresh logs every 30 seconds
    const interval = setInterval(fetchLogs, 30000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({
      ...filters,
      [name]: value
    });
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    fetchLogs();
  };
  
  const getLogLevelBadge = (level) => {
    const variant = 
      level === 'ERROR' ? 'danger' :
      level === 'WARNING' ? 'warning' :
      level === 'INFO' ? 'info' :
      level === 'DEBUG' ? 'secondary' : 
      'light';
    
    return <Badge bg={variant}>{level}</Badge>;
  };
  
  return (
    <div className="log-viewer">
      <Card>
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h3 className="mb-0">Application Logs</h3>
            <span>
              Showing {logs.length} of {totalLogs} logs
            </span>
          </div>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSubmit} className="mb-3">
            <div className="d-flex gap-3">
              <Form.Group className="flex-grow-2">
                <InputGroup>
                  <InputGroup.Text>Search</InputGroup.Text>
                  <Form.Control
                    type="text"
                    name="search"
                    value={filters.search}
                    onChange={handleFilterChange}
                    placeholder="Search logs..."
                  />
                </InputGroup>
              </Form.Group>
              
              <Form.Group>
                <InputGroup>
                  <InputGroup.Text>Level</InputGroup.Text>
                  <Form.Select
                    name="level"
                    value={filters.level}
                    onChange={handleFilterChange}
                  >
                    <option value="">All Levels</option>
                    <option value="ERROR">ERROR</option>
                    <option value="WARNING">WARNING</option>
                    <option value="INFO">INFO</option>
                    <option value="DEBUG">DEBUG</option>
                  </Form.Select>
                </InputGroup>
              </Form.Group>
              
              <Form.Group>
                <InputGroup>
                  <InputGroup.Text>Limit</InputGroup.Text>
                  <Form.Select
                    name="limit"
                    value={filters.limit}
                    onChange={handleFilterChange}
                  >
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="200">200</option>
                    <option value="500">500</option>
                  </Form.Select>
                </InputGroup>
              </Form.Group>
              
              <Button type="submit" variant="primary">Apply Filters</Button>
            </div>
          </Form>
          
          {loading && <div className="text-center my-4"><Spinner animation="border" /></div>}
          
          {error && <div className="alert alert-danger">{error}</div>}
          
          {!loading && logs.length === 0 && (
            <div className="alert alert-info">No logs found matching your criteria.</div>
          )}
          
          {!loading && logs.length > 0 && (
            <div className="table-responsive">
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th style={{ width: '180px' }}>Timestamp</th>
                    <th style={{ width: '100px' }}>Level</th>
                    <th>Message</th>
                    <th style={{ width: '180px' }}>Request ID</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, index) => (
                    <tr key={index}>
                      <td className="text-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td>{getLogLevelBadge(log.level)}</td>
                      <td>{log.message}</td>
                      <td className="text-muted small">{log.request_id || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default LogViewer; 