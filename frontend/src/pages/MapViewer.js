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
  
  // Add a visibleMapIds state variable to track which maps are currently visible
  const [visibleMapIds, setVisibleMapIds] = useState([]);
  
  useEffect(() => {
    if (projectId) {
      loadProjectData(parseInt(projectId, 10));
    }
  }, [projectId]);
  
  // Update the state when the selected map changes
  useEffect(() => {
    if (selectedMap && selectedMap.visibleMaps) {
      setVisibleMapIds(selectedMap.visibleMaps);
    } else if (selectedMap) {
      setVisibleMapIds([selectedMap.id]);
    } else {
      setVisibleMapIds([]);
    }
  }, [selectedMap]);
  
  const loadProjectData = async (pid) => {
    try {
      setLoading(true);
      
      // Fetch the specific project by ID
      const projectData = await fetchProjectById(pid);
      setProject(projectData);
      
      // Fetch maps for the project
      const mapsData = await fetchMaps(pid);
      setMaps(mapsData);
      
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
      
      // If there are maps, select the first one
      if (mapsData.length > 0) {
        setSelectedMap(mapsData[0]);
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
  
  // Add a function to window that can be called from anywhere to refresh maps data
  window.refreshMapsData = async () => {
    if (projectId) {
      try {
        // Only fetch maps, not the entire project data
        const mapsData = await fetchMaps(parseInt(projectId, 10));
        setMaps(mapsData);
        showNotification('Maps updated successfully!', 'success');
      } catch (error) {
        console.error('Error refreshing maps:', error);
        showNotification('Error refreshing maps data.', 'error');
      }
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
    // Check if the map already exists (update case)
    const existingMapIndex = maps.findIndex(m => m.id === newMap.id);
    
    if (existingMapIndex >= 0) {
      // Update existing map
      const updatedMaps = [...maps];
      updatedMaps[existingMapIndex] = newMap;
      setMaps(updatedMaps);
      
      // If it was the selected map, update that too
      if (selectedMap && selectedMap.id === newMap.id) {
        setSelectedMap(newMap);
      }
      
      showNotification('Map updated successfully!');
    } else {
      // Add new map
      setMaps([...maps, newMap]);
      setSelectedMap(newMap);
      showNotification('Map added successfully!');
    }
    
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
    if (!selectedMap) {
      showNotification('Please select a map first before adding an event.', 'warning');
      // Maybe direct them to map selection
      setActiveTab('project-maps');
      return;
    }
    
    // Store reference to map and set selecting location mode
    setMapForEvent(selectedMap);
    
    // Notify user to click on the map
    showNotification('Click on the map to place your event.', 'info');
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
      setMapForEvent(prev => ({
        ...prev,
        visibleMaps: map.visibleMaps || []
      }));
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
                <div className="sidebar-panel">
                  <h5 className="mb-3">Map Controls</h5>
                  
                  <div className="d-grid gap-2 mb-4">
                    <Button variant="success" onClick={handleAddEvent}>
                      <i className="bi bi-pin-map me-2"></i>Add Event
                    </Button>
                  </div>
                  
                  <hr />
                  
                  <div className="map-info-section">
                    <h6>Current View</h6>
                    {selectedMap && (
                      <div className="current-map-info mb-3">
                        <p className="mb-1"><strong>Main Map:</strong> {selectedMap.name}</p>
                        <p className="mb-1"><strong>Visible Layers:</strong> {visibleMapIds.length || 1}</p>
                        <p className="mb-0">
                          <strong>Events:</strong> {events.filter(e => visibleMapIds.includes(e.map_id)).length}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <hr />
                  
                  <div className="events-summary mb-3">
                    <h6>Event Categories</h6>
                    {/* Group events by tags */}
                    <ul className="list-unstyled">
                      {Array.from(new Set(events.flatMap(e => e.tags || []))).map(tag => (
                        <li key={tag} className="mb-1">
                          <span className="badge bg-secondary me-2">{tag}</span>
                          <span>{events.filter(e => e.tags?.includes(tag)).length}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
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
                    onVisibleMapsChanged={setVisibleMapIds}
                  />
                ) : (
                  <div className="text-center p-5 bg-light rounded">
                    <h3>No map selected</h3>
                    <p>Please select a map from the Project Maps tab or add a new one.</p>
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
        visibleMaps={selectedMap?.visibleMaps || []}
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