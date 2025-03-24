import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Button, Alert, Modal, Form, Tab, Tabs, Table } from 'react-bootstrap';
import { mapService, eventService } from '../services/api';

const MapDetail = () => {
  const { mapId } = useParams();
  const navigate = useNavigate();
  const [map, setMap] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState({ x: 0, y: 0 });
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    status: 'open',
    image: null
  });
  const imageRef = useRef(null);

  useEffect(() => {
    fetchMapDetails();
  }, [mapId]);

  const fetchMapDetails = async () => {
    try {
      setLoading(true);
      const mapResponse = await mapService.getMap(mapId);
      setMap(mapResponse.data);
      
      // Fetch events for this map
      const eventsResponse = await eventService.getEvents();
      // Filter events by this map
      const mapEvents = eventsResponse.data.filter(event => event.map_id === parseInt(mapId));
      setEvents(mapEvents);
      
      setError('');
    } catch (err) {
      console.error('Error fetching map details:', err);
      setError('Failed to load map details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = (e) => {
    if (!imageRef.current) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate percentage position (useful for different screen sizes)
    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;
    
    setSelectedPosition({ x: xPercent, y: yPercent });
    setShowEventModal(true);
  };

  const handleFileChange = (e) => {
    setNewEvent({ ...newEvent, image: e.target.files[0] });
  };

  const handleCreateEvent = async () => {
    try {
      if (!newEvent.title) {
        setError('Event title is required');
        return;
      }
      
      const eventData = {
        map_id: mapId,
        title: newEvent.title,
        description: newEvent.description,
        x_coordinate: selectedPosition.x,
        y_coordinate: selectedPosition.y,
        status: newEvent.status,
        image: newEvent.image
      };
      
      await eventService.createEvent(eventData);
      setShowEventModal(false);
      setNewEvent({
        title: '',
        description: '',
        status: 'open',
        image: null
      });
      fetchMapDetails();
    } catch (err) {
      console.error('Error creating event:', err);
      setError('Failed to create event. Please try again.');
    }
  };

  if (loading) {
    return <Container><p className="text-center mt-5">Loading map details...</p></Container>;
  }

  if (!map) {
    return (
      <Container>
        <Alert variant="danger">
          Map not found or you don't have access.
        </Alert>
        <Button variant="primary" onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </Container>
    );
  }

  return (
    <Container>
      <div className="mb-4">
        <Button 
          variant="outline-secondary" 
          onClick={() => navigate(`/projects/${map.project_id}`)}
        >
          ← Back to Project
        </Button>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>{map.name}</h2>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Tabs className="mb-4" defaultActiveKey="map">
        <Tab eventKey="map" title="Map View">
          <Card>
            <Card.Body>
              <p className="mb-4">
                Click anywhere on the map to report an incident or issue at that location.
              </p>
              
              <div className="position-relative" style={{ cursor: 'crosshair' }}>
                <img
                  ref={imageRef}
                  src={`http://localhost:8000/uploads/${map.file_path}`}
                  alt={map.name}
                  className="img-fluid"
                  onClick={handleImageClick}
                />
                
                {/* Display event markers on the map */}
                {events.map(event => (
                  <div
                    key={event.id}
                    className="position-absolute event-marker"
                    style={{
                      left: `${event.x_coordinate}%`,
                      top: `${event.y_coordinate}%`,
                      transform: 'translate(-50%, -50%)',
                      cursor: 'pointer'
                    }}
                    title={event.title}
                  />
                ))}
              </div>
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="events" title="Events List">
          <div className="mb-3">
            <h4>Map Events</h4>
          </div>

          {events.length === 0 ? (
            <Alert variant="info">
              No events found for this map. Click on the map to create a new event.
            </Alert>
          ) : (
            <div className="table-responsive">
              <Table striped bordered hover>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(event => (
                    <tr key={event.id}>
                      <td>{event.title}</td>
                      <td>{event.description}</td>
                      <td>
                        <span className={`badge bg-${event.status === 'open' ? 'danger' : event.status === 'in_progress' ? 'warning' : 'success'}`}>
                          {event.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td>{new Date(event.created_at).toLocaleDateString()}</td>
                      <td>
                        <Button 
                          variant="outline-primary" 
                          size="sm"
                          onClick={() => {/* View event details */}}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Tab>
      </Tabs>

      {/* Create Event Modal */}
      <Modal show={showEventModal} onHide={() => setShowEventModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Report New Incident</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Title</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter incident title"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Describe the incident"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Status</Form.Label>
              <Form.Select
                value={newEvent.status}
                onChange={(e) => setNewEvent({ ...newEvent, status: e.target.value })}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Image (Optional)</Form.Label>
              <Form.Control
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />
              <Form.Text className="text-muted">
                Upload a photo of the incident if available
              </Form.Text>
            </Form.Group>
            <p className="text-muted">
              Incident coordinates: X: {selectedPosition.x.toFixed(2)}%, Y: {selectedPosition.y.toFixed(2)}%
            </p>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEventModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreateEvent}>
            Create Incident
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default MapDetail; 