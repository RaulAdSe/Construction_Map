import React, { useState, useEffect } from 'react';
import { Card, Table, Form, Button, Row, Col, Spinner, Badge } from 'react-bootstrap';
import { getUserActivity } from '../../services/monitoringService';

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

  useEffect(() => {
    fetchActivities();
    
    // Refresh activities every 30 seconds
    const interval = setInterval(fetchActivities, 30000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <div className="user-activity">
      <Card>
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h3 className="mb-0">User Activity</h3>
            <Button 
              variant="outline-primary" 
              size="sm" 
              onClick={fetchActivities}
              disabled={loading}
            >
              Refresh
            </Button>
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
    </div>
  );
};

export default UserActivity; 