import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Navbar, Nav, Spinner, Alert, Tabs, Tab } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import MapList from '../components/MapList';
import MapDetail from '../components/MapDetail';
import MapsManager from '../components/MapsManager';
import EventsTable from '../components/EventsTable';
import AddMapModal from '../components/AddMapModal';
import AddEventModal from '../components/AddEventModal';
import EditEventModal from '../components/EditEventModal';
import ViewEventModal from '../components/ViewEventModal';
import MapSelectionModal from '../components/MapSelectionModal';
import Notification from '../components/Notification';
import { fetchMaps, fetchProjects, fetchProjectById } from '../services/mapService';
import { fetchEvents } from '../services/eventService';
import '../assets/styles/MapViewer.css';

const MapViewer = ({ onLogout }) => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  const [maps, setMaps] = useState([]);
  const [events, setEvents] = useState([]);
  const [project, setProject] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('map-view');

  const [showAddMapModal, setShowAddMapModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [showMapSelectionModal, setShowMapSelectionModal] = useState(false);
  const [showViewEventModal, setShowViewEventModal] = useState(false);
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  
  // For event creation workflow
  const [mapForEvent, setMapForEvent] = useState(null);
  const [eventPosition, setEventPosition] = useState({ x: 0, y: 0 });
  const [selectedEvent, setSelectedEvent] = useState(null);
  
  useEffect(() => {
    if (projectId) {
      loadProjectData(parseInt(projectId, 10));
    }
  }, [projectId]);
  
  const loadProjectData = async (pid) => {
    try {
      setLoading(true);
      
      // Fetch the specific project by ID
      const projectData = await fetchProjectById(pid);
      setProject(projectData);
      
      // Fetch maps for the project
      const mapsData = await fetchMaps(pid);
      setMaps(mapsData);
      
      // Find the implantation map if it exists, or use the first map
      const mainMap = mapsData.find(m => m.map_type === 'implantation') || mapsData[0];
      
      // Fetch events for each map
      const allEvents = [];
      for (const map of mapsData) {
        const mapEvents = await fetchEvents(map.id);
        
        // Add map name to each event for better display
        const eventsWithMapName = mapEvents.map(event => ({
          ...event,
          map_name: map.name
        }));
        
        allEvents.push(...eventsWithMapName);
      }
      setEvents(allEvents);
      
      // If there are maps, select the implantation map or first available
      if (mapsData.length > 0) {
        setSelectedMap(mainMap);
      } else {
        setSelectedMap(null);
      }
    } catch (error) {
      console.error('Error loading project data:', error);
      showNotification('Error loading project data. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleBackToProjects = () => {
    navigate('/projects');
  };
  
  const handleMapSelect = (mapId) => {
    const map = maps.find(m => m.id === mapId);
    setSelectedMap(map);
  };
  
  const handleAddMap = () => {
    if (!project) {
      showNotification('No project selected.', 'error');
      return;
    }
    setShowAddMapModal(true);
  };
  
  const handleMapAdded = (newMap) => {
    setMaps([...maps, newMap]);
    setSelectedMap(newMap);
    showNotification('Map added successfully!');
    setShowAddMapModal(false);
  };
  
  const handleMapDeleted = (mapId) => {
    const updatedMaps = maps.filter(m => m.id !== mapId);
    setMaps(updatedMaps);
    
    // Also remove events associated with this map
    const updatedEvents = events.filter(e => e.map_id !== mapId);
    setEvents(updatedEvents);
    
    // If the deleted map was selected, select a different one
    if (selectedMap && selectedMap.id === mapId) {
      setSelectedMap(updatedMaps.length > 0 ? updatedMaps[0] : null);
    }
    
    showNotification('Map deleted successfully!');
  };
  
  const handleAddEvent = () => {
    if (maps.length === 0) {
      showNotification('Please add a map first.', 'error');
      return;
    }
    
    setShowMapSelectionModal(true);
  };
  
  const handleMapSelected = (mapId) => {
    const map = maps.find(m => m.id === mapId);
    setMapForEvent(map);
    setShowMapSelectionModal(false);
    showNotification('Click on the map to place your event.', 'info');
  };
  
  const handleMapClick = (map, x, y) => {
    if (mapForEvent && mapForEvent.id === map.id) {
      setEventPosition({ x, y });
      setShowAddEventModal(true);
    }
  };
  
  const handleEventAdded = (newEvent) => {
    // Add map name to the event for display
    const mapName = maps.find(m => m.id === newEvent.map_id)?.name || '';
    const eventWithMapName = { ...newEvent, map_name: mapName };
    
    setEvents([...events, eventWithMapName]);
    setMapForEvent(null);
    showNotification('Event added successfully!');
    setShowAddEventModal(false);
  };
  
  const handleViewEvent = (event) => {
    setSelectedEvent(event);
    setShowViewEventModal(true);
  };
  
  const handleEditEvent = (event) => {
    setSelectedEvent(event);
    setShowEditEventModal(true);
  };
  
  const handleEventUpdated = (updatedEvent) => {
    // Preserve the map_name field when updating the event
    const mapName = events.find(e => e.id === updatedEvent.id)?.map_name || '';
    const eventWithMapName = { ...updatedEvent, map_name: mapName };
    
    const updatedEvents = events.map(event => 
      event.id === updatedEvent.id ? eventWithMapName : event
    );
    
    setEvents(updatedEvents);
    showNotification('Event updated successfully!');
  };
  
  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ ...notification, show: false });
    }, 3000);
  };
  
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }
  
  if (!project) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">
          Project not found or you don't have access.
          <Button variant="link" onClick={handleBackToProjects}>
            Back to Projects
          </Button>
        </Alert>
      </Container>
    );
  }
  
  return (
    <div className="map-viewer">
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand onClick={handleBackToProjects} style={{ cursor: 'pointer' }}>
            Construction Map Viewer
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Item>
                <Nav.Link onClick={handleBackToProjects}>
                  &laquo; Back to Projects
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link active>
                  Project: {project.name}
                </Nav.Link>
              </Nav.Item>
            </Nav>
            <Button variant="outline-light" onClick={onLogout}>Logout</Button>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      
      <Container className="mt-4">
        <Tabs
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k)}
          className="mb-4"
        >
          <Tab eventKey="map-view" title="Map View">
            <Row>
              <Col md={3}>
                <div className="mb-3">
                  <Button variant="primary" onClick={handleAddMap} className="me-2">
                    Add Map
                  </Button>
                  <Button variant="success" onClick={handleAddEvent}>
                    Add Event
                  </Button>
                </div>
                
                <MapList 
                  maps={maps} 
                  selectedMap={selectedMap} 
                  onMapSelect={handleMapSelect} 
                />
              </Col>
              
              <Col md={9}>
                {selectedMap ? (
                  <MapDetail 
                    map={selectedMap} 
                    events={events}
                    onMapClick={handleMapClick}
                    isSelectingLocation={mapForEvent && mapForEvent.id === selectedMap.id}
                    onEventClick={handleViewEvent}
                    allMaps={maps.filter(m => m.project_id === project.id)}
                    projectId={project.id}
                  />
                ) : (
                  <div className="text-center p-5 bg-light rounded">
                    <h3>No map selected</h3>
                    <p>Please select a map from the list or add a new one.</p>
                  </div>
                )}
              </Col>
            </Row>
          </Tab>
          
          <Tab eventKey="project-maps" title="Project Maps">
            <MapsManager 
              maps={maps}
              onMapAdded={handleMapAdded}
              onMapDeleted={handleMapDeleted}
              projectId={project.id}
            />
          </Tab>
          
          <Tab eventKey="events" title="Events">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h3>Project Events</h3>
              <Button variant="success" onClick={handleAddEvent}>
                Add New Event
              </Button>
            </div>
            
            <EventsTable 
              events={events} 
              onViewEvent={handleViewEvent}
              onEditEvent={handleEditEvent}
            />
          </Tab>
        </Tabs>
      </Container>
      
      {/* Modals */}
      <AddMapModal 
        show={showAddMapModal} 
        onHide={() => setShowAddMapModal(false)} 
        onMapAdded={handleMapAdded}
        projectId={project?.id}
      />
      
      <MapSelectionModal 
        show={showMapSelectionModal}
        onHide={() => setShowMapSelectionModal(false)}
        maps={maps}
        onMapSelected={handleMapSelected}
      />
      
      <AddEventModal
        show={showAddEventModal}
        onHide={() => {
          setShowAddEventModal(false);
          setMapForEvent(null);
        }}
        mapId={mapForEvent?.id}
        position={eventPosition}
        onEventAdded={handleEventAdded}
        projectId={project?.id}
        allMaps={maps}
      />
      
      <ViewEventModal
        show={showViewEventModal}
        onHide={() => setShowViewEventModal(false)}
        event={selectedEvent}
        allMaps={maps}
      />
      
      <EditEventModal
        show={showEditEventModal}
        onHide={() => setShowEditEventModal(false)}
        event={selectedEvent}
        onEventUpdated={handleEventUpdated}
      />
      
      {/* Notification */}
      <Notification 
        show={notification.show}
        message={notification.message} 
        type={notification.type}
      />
    </div>
  );
};

export default MapViewer; 