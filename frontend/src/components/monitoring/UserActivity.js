import React, { useState, useEffect } from 'react';
import { Card, Table, Form, Button, Row, Col, Spinner, Badge, Alert, Modal } from 'react-bootstrap';
import { getUserActivity, getUserActivityStats, triggerUserActivityCleanup } from '../../services/monitoringService';

const UserActivity = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    username: '',
    action: '',
    userType: '',
    limit: 50
  });
  
  // Storage statistics state
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showStats, setShowStats] = useState(false);
  
  // Cleanup state
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await getUserActivity(filters);
      setActivities(data.activities || []);
    } catch (err) {
      console.error('Error fetching user activities:', err);
      setError('Failed to fetch user activity data.');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const data = await getUserActivityStats();
      setStats(data);
    } catch (err) {
      console.error('Error fetching user activity statistics:', err);
    } finally {
      setLoadingStats(false);
    }
  };
  
  const handleCleanup = async () => {
    try {
      setCleanupLoading(true);
      setCleanupResult(null);
      
      const result = await triggerUserActivityCleanup();
      setCleanupResult(result);
      
      // Refresh stats and activities after cleanup
      fetchStats();
      fetchActivities();
    } catch (err) {
      console.error('Error during cleanup:', err);
      setCleanupResult({ status: 'error', message: 'Failed to perform cleanup' });
    } finally {
      setCleanupLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    fetchStats();
    
    // Refresh activities every 30 seconds
    const interval = setInterval(fetchActivities, 30000);
    
    return () => clearInterval(interval);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps
  // We're intentionally not including fetchActivities and fetchStats as dependencies
  // to prevent unnecessary refetching when filters change

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    fetchActivities();
  };

  const getActionBadge = (action) => {
    if (action.includes('login_success')) {
      return <Badge bg="success">Login Success</Badge>;
    } else if (action.includes('login_failed')) {
      return <Badge bg="danger">Login Failed</Badge>;
    } else if (action.includes('register_success')) {
      return <Badge bg="info">Registration</Badge>;
    } else if (action.includes('project_create')) {
      return <Badge bg="primary">Create Project</Badge>;
    } else if (action.includes('project_update')) {
      return <Badge bg="warning">Update Project</Badge>;
    } else if (action.includes('project_delete')) {
      return <Badge bg="danger">Delete Project</Badge>;
    } else if (action.includes('map_')) {
      return <Badge bg="secondary">Map Action</Badge>;
    } else if (action.includes('event_')) {
      return <Badge bg="info">Event Action</Badge>;
    }
    return <Badge bg="secondary">{action}</Badge>;
  };

  const getUserTypeBadge = (userType) => {
    if (userType === 'admin') {
      return <Badge bg="danger">Admin</Badge>;
    } else if (userType === 'member') {
      return <Badge bg="info">Member</Badge>;
    }
    return <Badge bg="secondary">{userType}</Badge>;
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="user-activity">
      <Card className="mb-4">
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h3 className="mb-0">User Activity</h3>
            <div>
              <Button 
                variant="outline-info" 
                size="sm" 
                className="me-2"
                onClick={() => setShowStats(true)}
                disabled={loadingStats}
              >
                {loadingStats ? <Spinner animation="border" size="sm" /> : 'Storage Statistics'}
              </Button>
              <Button 
                variant="outline-primary" 
                size="sm" 
                onClick={fetchActivities}
                disabled={loading}
              >
                Refresh
              </Button>
            </div>
          </div>
        </Card.Header>
        
        <Card.Body>
          <Form onSubmit={handleSubmit} className="mb-4">
            <Row>
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label>Username</Form.Label>
                  <Form.Control
                    type="text"
                    name="username"
                    value={filters.username}
                    onChange={handleFilterChange}
                    placeholder="Filter by username"
                  />
                </Form.Group>
              </Col>
              
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label>Action</Form.Label>
                  <Form.Select
                    name="action"
                    value={filters.action}
                    onChange={handleFilterChange}
                  >
                    <option value="">All actions</option>
                    <option value="login">Logins</option>
                    <option value="register">Registrations</option>
                    <option value="project">Project actions</option>
                    <option value="map">Map actions</option>
                    <option value="event">Event actions</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label>User Type</Form.Label>
                  <Form.Select
                    name="userType"
                    value={filters.userType}
                    onChange={handleFilterChange}
                  >
                    <option value="">All users</option>
                    <option value="admin">Admins</option>
                    <option value="member">Members</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              
              <Col md={3}>
                <Form.Group className="mb-3">
                  <Form.Label>Limit</Form.Label>
                  <Form.Select
                    name="limit"
                    value={filters.limit}
                    onChange={handleFilterChange}
                  >
                    <option value="25">25 records</option>
                    <option value="50">50 records</option>
                    <option value="100">100 records</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            
            <div className="d-flex justify-content-end">
              <Button 
                type="submit" 
                variant="primary"
                disabled={loading}
              >
                Apply Filters
              </Button>
            </div>
          </Form>
          
          {loading && (
            <div className="text-center my-4">
              <Spinner animation="border" />
              <p className="mt-2">Loading user activity...</p>
            </div>
          )}
          
          {error && <div className="alert alert-danger">{error}</div>}
          
          {!loading && activities.length === 0 && (
            <div className="alert alert-info">No user activity found.</div>
          )}
          
          {!loading && activities.length > 0 && (
            <div className="table-responsive">
              <Table striped hover>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Username</th>
                    <th>User Type</th>
                    <th>Action</th>
                    <th>IP Address</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((activity, index) => (
                    <tr key={index}>
                      <td>{new Date(activity.timestamp).toLocaleString()}</td>
                      <td>{activity.username}</td>
                      <td>{getUserTypeBadge(activity.user_type)}</td>
                      <td>{getActionBadge(activity.action)}</td>
                      <td>{activity.ip_address}</td>
                      <td>
                        {activity.details && Object.keys(activity.details).length > 0 ? (
                          <pre className="mb-0" style={{ fontSize: '0.8rem' }}>
                            {JSON.stringify(activity.details, null, 2)}
                          </pre>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
        
        <Card.Footer>
          <small className="text-muted">
            Showing {activities.length} user activities. Last refreshed: {new Date().toLocaleString()}
          </small>
        </Card.Footer>
      </Card>
      
      {/* Statistics Modal */}
      <Modal show={showStats} onHide={() => setShowStats(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>User Activity Storage Statistics</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingStats ? (
            <div className="text-center my-4">
              <Spinner animation="border" />
              <p>Loading statistics...</p>
            </div>
          ) : !stats ? (
            <Alert variant="warning">No statistics available</Alert>
          ) : (
            <>
              <Row className="mb-4">
                <Col md={4}>
                  <Card className="text-center h-100">
                    <Card.Body>
                      <h5>Total Activities</h5>
                      <h2>{stats.total_activities || 0}</h2>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="text-center h-100">
                    <Card.Body>
                      <h5>Retention Period</h5>
                      <h2>{stats.retention_days || 0} days</h2>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={4}>
                  <Card className="text-center h-100">
                    <Card.Body>
                      <h5>Max Per User</h5>
                      <h2>{stats.max_per_user || 0}</h2>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
              
              <Row className="mb-4">
                <Col md={6}>
                  <Card className="h-100">
                    <Card.Body>
                      <h5>Time Range</h5>
                      <p><strong>Oldest:</strong> {formatDate(stats.oldest_activity)}</p>
                      <p><strong>Newest:</strong> {formatDate(stats.newest_activity)}</p>
                    </Card.Body>
                  </Card>
                </Col>
                
                <Col md={6}>
                  <Card className="h-100">
                    <Card.Body>
                      <h5>Storage Policy</h5>
                      <p>Activities are automatically cleaned up when they are older than {stats.retention_days} days.</p>
                      <p>Each user is limited to {stats.max_per_user} most recent activities.</p>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
              
              <h5>User Activity Breakdown</h5>
              {stats.user_statistics && stats.user_statistics.length > 0 ? (
                <Table striped size="sm">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Activity Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.user_statistics.map((user, index) => (
                      <tr key={index}>
                        <td>{user.username}</td>
                        <td>{user.activity_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <p>No user statistics available</p>
              )}
              
              <div className="d-flex justify-content-end mt-3">
                <Button 
                  variant="warning" 
                  onClick={() => {
                    setShowStats(false);
                    setShowCleanupModal(true);
                  }}
                >
                  Manual Cleanup
                </Button>
              </div>
            </>
          )}
        </Modal.Body>
      </Modal>
      
      {/* Cleanup Confirmation Modal */}
      <Modal show={showCleanupModal} onHide={() => setShowCleanupModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Activity Cleanup</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {cleanupResult ? (
            <Alert variant={cleanupResult.status === 'success' ? 'success' : 'danger'}>
              {cleanupResult.message}
            </Alert>
          ) : (
            <>
              <p>This will permanently delete old user activity records based on the retention policy:</p>
              <ul>
                <li>Records older than {stats?.retention_days || 90} days will be removed</li>
                <li>Each user will be limited to their {stats?.max_per_user || 1000} most recent activities</li>
              </ul>
              <p className="text-danger">This action cannot be undone. Are you sure you want to proceed?</p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          {cleanupResult ? (
            <Button variant="secondary" onClick={() => setShowCleanupModal(false)}>Close</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setShowCleanupModal(false)} disabled={cleanupLoading}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleCleanup} disabled={cleanupLoading}>
                {cleanupLoading ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Cleaning up...
                  </>
                ) : 'Perform Cleanup'}
              </Button>
            </>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default UserActivity; 