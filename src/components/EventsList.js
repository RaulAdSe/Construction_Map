import React, { useState, useEffect } from 'react';
import { Container, Table, Badge, Button, Alert, Form, Row, Col, Card } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { eventService, mapService, projectService } from '../services/api';

const EventsList = () => {
  const [events, setEvents] = useState([]);
  const [maps, setMaps] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    projectId: '',
    mapId: '',
    status: ''
  });
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch events, maps and projects in parallel
      const [eventsResponse, mapsResponse, projectsResponse] = await Promise.all([
        eventService.getEvents(),
        mapService.getMaps(),
        projectService.getProjects()
      ]);
      
      setEvents(eventsResponse.data);
      setMaps(mapsResponse.data);
      setProjects(projectsResponse.data);
      
      setError('');
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getMapName = (mapId) => {
    const map = maps.find(m => m.id === mapId);
    return map ? map.name : 'Unknown Map';
  };

  const getProjectName = (mapId) => {
    const map = maps.find(m => m.id === mapId);
    if (!map) return 'Unknown Project';
    
    const project = projects.find(p => p.id === map.project_id);
    return project ? project.name : 'Unknown Project';
  };

  const handleViewMap = (mapId) => {
    navigate(`/maps/${mapId}`);
  };

  const handleFilterChange = (field, value) => {
    setFilters({
      ...filters,
      [field]: value
    });
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'open':
        return 'danger';
      case 'in_progress':
        return 'warning';
      case 'resolved':
        return 'success';
      default:
        return 'secondary';
    }
  };

  // Apply filters to events
  const filteredEvents = events.filter(event => {
    // Filter by status if selected
    if (filters.status && event.status !== filters.status) {
      return false;
    }
    
    // Filter by map if selected
    if (filters.mapId && event.map_id !== parseInt(filters.mapId)) {
      return false;
    }
    
    // Filter by project if selected
    if (filters.projectId) {
      const map = maps.find(m => m.id === event.map_id);
      if (!map || map.project_id !== parseInt(filters.projectId)) {
        return false;
      }
    }
    
    return true;
  });

  if (loading) {
    return <Container><p className="text-center mt-5">Loading events...</p></Container>;
  }

  return (
    <Container>
      <h2 className="mb-4">All Events</h2>
      
      {error && <Alert variant="danger">{error}</Alert>}
      
      {/* Filters */}
      <Card className="mb-4">
        <Card.Body>
          <Card.Title>Filters</Card.Title>
          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Project</Form.Label>
                <Form.Select
                  value={filters.projectId}
                  onChange={(e) => handleFilterChange('projectId', e.target.value)}
                >
                  <option value="">All Projects</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Map</Form.Label>
                <Form.Select
                  value={filters.mapId}
                  onChange={(e) => handleFilterChange('mapId', e.target.value)}
                >
                  <option value="">All Maps</option>
                  {maps
                    .filter(map => !filters.projectId || map.project_id === parseInt(filters.projectId))
                    .map(map => (
                      <option key={map.id} value={map.id}>
                        {map.name}
                      </option>
                    ))
                  }
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Status</Form.Label>
                <Form.Select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>
      
      {filteredEvents.length === 0 ? (
        <Alert variant="info">
          No events found matching the selected filters.
        </Alert>
      ) : (
        <div className="table-responsive">
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>Title</th>
                <th>Project</th>
                <th>Map</th>
                <th>Description</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map(event => (
                <tr key={event.id}>
                  <td>{event.title}</td>
                  <td>{getProjectName(event.map_id)}</td>
                  <td>{getMapName(event.map_id)}</td>
                  <td>{event.description}</td>
                  <td>
                    <Badge bg={getStatusBadgeVariant(event.status)}>
                      {event.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td>{new Date(event.created_at).toLocaleString()}</td>
                  <td>
                    <Button 
                      variant="outline-primary" 
                      size="sm"
                      onClick={() => handleViewMap(event.map_id)}
                    >
                      View Map
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </Container>
  );
};

export default EventsList; 