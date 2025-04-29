import React, { useState, useEffect } from 'react';
import { Card, Table, Badge, Button, Spinner } from 'react-bootstrap';
import { getSlowQueries } from '../../services/monitoringService';

const DatabaseMonitor = () => {
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fromLog, setFromLog] = useState(false);

  const fetchQueries = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await getSlowQueries({ fromLog, limit: 50 });
      
      // Make sure each query has the expected fields or provide default values
      const processedQueries = data.queries.map(query => ({
        ...query,
        operation: query.operation_type || query.operation || 'unknown',
        table: query.table || 'unknown',
        timestamp: query.timestamp || new Date().toISOString(),
        duration: query.duration || 0
      }));
      
      setQueries(processedQueries);
    } catch (err) {
      console.error('Error fetching slow queries:', err);
      setError('Failed to fetch database query information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueries();
    
    // Refresh slow queries data every 30 seconds
    const interval = setInterval(fetchQueries, 30000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromLog]);

  const toggleQuerySource = () => {
    setFromLog(!fromLog);
  };

  const getOperationBadge = (operation) => {
    // Handle undefined operation
    if (!operation) {
      return <Badge bg="secondary">UNKNOWN</Badge>;
    }
    
    // Make sure operation is a string
    const op = String(operation).toLowerCase();
    
    const variant = 
      op === 'select' ? 'info' :
      op === 'insert' ? 'success' :
      op === 'update' ? 'warning' :
      op === 'delete' ? 'danger' : 
      'secondary';
    
    return <Badge bg={variant}>{op.toUpperCase()}</Badge>;
  };

  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) {
      return 'N/A';
    }
    
    if (seconds < 1) {
      return `${Math.round(seconds * 1000)} ms`;
    }
    return `${seconds.toFixed(2)} s`;
  };

  return (
    <div className="database-monitor">
      <Card>
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h3 className="mb-0">Slow Database Queries</h3>
            <div>
              <Button 
                variant="outline-secondary" 
                size="sm" 
                onClick={toggleQuerySource}
                className="me-2"
              >
                {fromLog ? 'Show Recent Queries' : 'Show Historical Queries'}
              </Button>
              <Button 
                variant="outline-primary" 
                size="sm" 
                onClick={fetchQueries}
              >
                Refresh
              </Button>
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          {loading && <div className="text-center my-4"><Spinner animation="border" /></div>}
          
          {error && <div className="alert alert-danger">{error}</div>}
          
          {!loading && queries.length === 0 && (
            <div className="alert alert-info">No slow queries detected.</div>
          )}
          
          {!loading && queries.length > 0 && (
            <div className="table-responsive">
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th style={{ width: '180px' }}>Timestamp</th>
                    <th style={{ width: '100px' }}>Operation</th>
                    <th style={{ width: '120px' }}>Table</th>
                    <th style={{ width: '100px' }}>Duration</th>
                    <th>Query</th>
                  </tr>
                </thead>
                <tbody>
                  {queries.map((query, index) => (
                    <tr key={index}>
                      <td className="text-nowrap">
                        {new Date(query.timestamp).toLocaleString()}
                      </td>
                      <td>{getOperationBadge(query.operation)}</td>
                      <td>{query.table || 'N/A'}</td>
                      <td>
                        <Badge 
                          bg={query.duration > 2 ? 'danger' : query.duration > 1 ? 'warning' : 'info'}
                        >
                          {formatDuration(query.duration)}
                        </Badge>
                      </td>
                      <td>
                        <div 
                          style={{
                            maxHeight: '100px',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            fontSize: '0.85rem',
                            fontFamily: 'monospace'
                          }}
                        >
                          {query.query || 'Query not available'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
        <Card.Footer className="text-muted">
          Showing {queries.length} slow queries
          {fromLog ? ' from logs' : ' from recent memory'}. 
          Queries taking longer than 500ms are considered slow.
        </Card.Footer>
      </Card>
    </div>
  );
};

export default DatabaseMonitor; 