import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Container, Row, Col, Button, Navbar, Nav, Spinner, Alert, Tabs, Tab } from 'react-bootstrap';
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
import NotificationBell from '../components/NotificationBell';
import RoleSwitcher from '../components/RoleSwitcher';
import ContactsTab from '../components/ContactsTab';
import { fetchMaps, fetchProjects, fetchProjectById } from '../services/mapService';
import { fetchEvents } from '../services/eventService';
import { isUserAdmin } from '../utils/permissions';
import '../assets/styles/MapViewer.css';

const MapViewer = ({ onLogout }) => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [maps, setMaps] = useState([]);
  const [events, setEvents] = useState([]);
  const [project, setProject] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('map-view');
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false); // User's actual admin status
  const [effectiveIsAdmin, setEffectiveIsAdmin] = useState(false); // The admin status to use for permissions (can be overridden)

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
  
  // Add a state variable for the comment to highlight
  const [highlightCommentId, setHighlightCommentId] = useState(null);
  
  // Fetch current user info from token and get their admin status
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        
        if (storedUser && token) {
          const user = JSON.parse(storedUser);
          setCurrentUser(user);
          
          // Set admin status based on is_admin flag
          const userIsAdmin = user.is_admin === true;
          console.log('User admin status:', userIsAdmin);
          setIsAdmin(userIsAdmin);
          setEffectiveIsAdmin(userIsAdmin);
        }
      } catch (error) {
        console.error('Error fetching current user:', error);
      }
    };
    
    fetchCurrentUser();
  }, [projectId]);
  
  // Handle role change from the RoleSwitcher
  const handleRoleChange = (newIsAdmin) => {
    setEffectiveIsAdmin(newIsAdmin);
    showNotification(`Viewing as ${newIsAdmin ? 'Admin' : 'Member'}`, 'info');
    
    // If switching to member view and current tab is admin-only, switch to map view
    if (!newIsAdmin && (activeTab === 'project-maps' || activeTab === 'events')) {
      setActiveTab('map-view');
    }
  };
  
  // Add a visibleMapIds state variable to track which maps are currently visible
  const [visibleMapIds, setVisibleMapIds] = useState([]);
  // Add a visibleEvents state to track events filtered by visible maps
  const [visibleEvents, setVisibleEvents] = useState([]);
  
  // Update visible events whenever events or visible maps change
  useEffect(() => {
    // Filter events based on visible maps
    const filteredEvents = events.filter(event => {
      if (!event || !event.map_id) return false;
      
      // Skip closed events regardless of map
      if (event.status === 'closed') return false;
      
      // Always include events from the main map (implantation type)
      const mainMap = maps.find(map => map.map_type === 'implantation');
      if (mainMap && event.map_id === mainMap.id) {
        return true;
      }
      
      // For other maps, only include if they're in the visible maps list
      return visibleMapIds.includes(event.map_id);
    });
    
    setVisibleEvents(filteredEvents);
    console.log("Updated visible events:", filteredEvents.length, "out of", events.length);
  }, [events, visibleMapIds, maps]);
  
  useEffect(() => {
    if (projectId) {
      loadProjectData(parseInt(projectId, 10));
    }
  }, [projectId]);
  
  // Update the visible maps when the selected map changes
  useEffect(() => {
    if (selectedMap) {
      // Make sure the selectedMap's ID is in visibleMapIds
      if (!visibleMapIds.includes(selectedMap.id)) {
        setVisibleMapIds(prev => [...prev, selectedMap.id]);
      }
      console.log("Selected map changed, ensuring it's visible:", selectedMap.id);
    }
  }, [selectedMap]);
  
  // Initialize visibleMapIds when maps are loaded
  useEffect(() => {
    if (maps.length > 0) {
      // Find the main map
      const mainMap = maps.find(map => map.map_type === 'implantation');
      
      if (mainMap) {
        // Initialize with the main map
        console.log("Initializing visible maps with main map:", mainMap.id);
        
        // Check if already in the list to avoid duplicates
        if (!visibleMapIds.includes(mainMap.id)) {
          setVisibleMapIds(prev => [mainMap.id, ...prev.filter(id => id !== mainMap.id)]);
        }
      }
    }
  }, [maps]);
  
  // Handle updates to visible maps from MapDetail component
  const handleVisibleMapsChanged = (newVisibleMapIds) => {
    console.log("Visible maps changed to:", newVisibleMapIds);
    setVisibleMapIds(newVisibleMapIds);
  };
  
  // Reload map data when switching to Map View tab
  useEffect(() => {
    if (activeTab === 'map-view' && projectId) {
      // We only want to reload the maps to get any updated main map
      const refreshMaps = async () => {
        try {
          const mapsData = await fetchMaps(parseInt(projectId, 10));
          
          // If the map types have changed, we need to update our state
          const mainMap = mapsData.find(map => map.map_type === 'implantation');
          
          // Update the maps list
          setMaps(mapsData);
          
          // If we have a main map and it's different from the currently selected map
          if (mainMap && (!selectedMap || mainMap.id !== selectedMap.id)) {
            console.log('Main map changed, updating selected map');
            setSelectedMap(mainMap);
          }
        } catch (error) {
          console.error('Error refreshing maps on tab change:', error);
        }
      };
      
      refreshMaps();
    }
  }, [activeTab, projectId, selectedMap]);
  
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
      
      // Select the main map (implantation type) if available, otherwise select the first map
      if (mapsData.length > 0) {
        const mainMap = mapsData.find(map => map.map_type === 'implantation');
        if (mainMap) {
          console.log('Found and selected main map:', mainMap.name);
          setSelectedMap(mainMap);
          
          // Initialize visible maps with the main map ID
          setVisibleMapIds([mainMap.id]);
        } else {
          console.log('No main map found, selecting first map');
          setSelectedMap(mapsData[0]);
          
          // Initialize visible maps with the first map ID
          setVisibleMapIds([mapsData[0].id]);
        }
      } else {
        setSelectedMap(null);
        setVisibleMapIds([]);
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
    
    // Reset highlight comment when manually selecting an event
    setHighlightCommentId(null);
    
    setShowViewEventModal(true);
  };
  
  const handleEditEvent = (event) => {
    setSelectedEvent(event);
    setShowEditEventModal(true);
  };
  
  const handleEventUpdated = (updatedEvent) => {
    // Preserve the map_name field when updating the event
    const mapName = events.find(e => e.id === updatedEvent.id)?.map_name || '';
    const existingEvent = events.find(e => e.id === updatedEvent.id) || {};
    
    // Merge the updated event with existing data, preserving fields that might be missing
    const eventWithMapName = { 
      ...existingEvent,
      ...updatedEvent, 
      map_name: mapName 
    };
    
    const updatedEvents = events.map(event => 
      event.id === updatedEvent.id ? eventWithMapName : event
    );
    
    setEvents(updatedEvents);
    showNotification('Event updated successfully!');
    
    // If we updated the selected event, also update it
    if (selectedEvent && selectedEvent.id === updatedEvent.id) {
      setSelectedEvent(eventWithMapName);
    }
  };
  
  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ ...notification, show: false });
    }, 3000);
  };
  
  // Add a debug function to check and fix admin status
  window.debugAdmin = () => {
    try {
      // Check current localStorage
      const token = localStorage.getItem('token');
      const userJson = localStorage.getItem('user');
      console.log('Current token:', token);
      console.log('Current user data:', userJson);
      
      // Try to decode the token
      if (token) {
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        console.log('Token payload:', tokenPayload);
        
        // If we have a token but no user data, create user data
        if (!userJson) {
          const username = tokenPayload.sub;
          // Create a basic user object
          const user = {
            username: username,
            is_admin: username === 'admin', // Assume username 'admin' is an admin
            id: username
          };
          localStorage.setItem('user', JSON.stringify(user));
          console.log('Created user data:', user);
          alert('Added missing user data. Please refresh the page.');
          return user;
        }
      }
      return JSON.parse(userJson || '{}');
    } catch (e) {
      console.error('Error in debugAdmin:', e);
      return null;
    }
  };
  
  // Extract highlight info from location state or query parameters
  useEffect(() => {
    const checkForHighlightedEvent = async () => {
      // Check if we have highlight info in location state (from programmatic navigation)
      const highlightEventId = location.state?.highlightEventId;
      const highlightCommentId = location.state?.highlightCommentId;
      
      // If we have an event to highlight from the state
      if (highlightEventId && events.length > 0) {
        console.log(`Highlighting event ${highlightEventId} from notification navigation`);
        
        // Find the event
        const eventToHighlight = events.find(e => e.id === parseInt(highlightEventId, 10));
        
        if (eventToHighlight) {
          // Select the event's map
          const eventMap = maps.find(m => m.id === eventToHighlight.map_id);
          if (eventMap) {
            setSelectedMap(eventMap);
            
            // Make sure this map is visible
            if (!visibleMapIds.includes(eventMap.id)) {
              setVisibleMapIds(prev => [...prev, eventMap.id]);
            }
          }
          
          // Set the selected event and show the event modal
          setSelectedEvent(eventToHighlight);
          
          // Store the comment ID for highlighting
          if (highlightCommentId) {
            // Store the highlight comment ID in a state variable
            setHighlightCommentId(parseInt(highlightCommentId, 10));
          }
          
          setShowViewEventModal(true);
          
          // Clear the highlight info from location state after processing
          try {
            window.history.replaceState({}, document.title);
          } catch (error) {
            console.error('Failed to clear history state:', error);
          }
        }
      }
      
      // Check URL parameters (for direct links)
      const urlParams = new URLSearchParams(window.location.search);
      const eventIdFromUrl = urlParams.get('event');
      const commentIdFromUrl = urlParams.get('comment');
      
      if (eventIdFromUrl && events.length > 0) {
        console.log(`Highlighting event ${eventIdFromUrl} from URL parameters`);
        
        // Find the event
        const eventToHighlight = events.find(e => e.id === parseInt(eventIdFromUrl, 10));
        
        if (eventToHighlight) {
          // Select the event's map
          const eventMap = maps.find(m => m.id === eventToHighlight.map_id);
          if (eventMap) {
            setSelectedMap(eventMap);
            
            // Make sure this map is visible
            if (!visibleMapIds.includes(eventMap.id)) {
              setVisibleMapIds(prev => [...prev, eventMap.id]);
            }
          }
          
          // Set the selected event and show the event modal
          setSelectedEvent(eventToHighlight);
          setShowViewEventModal(true);
          
          // Remove the parameters from the URL to prevent issues on refresh
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        }
      }
    };
    
    // Only run this effect after events are loaded
    if (events.length > 0 && !loading) {
      checkForHighlightedEvent();
    }
  }, [events, maps, location.state, loading]);
  
  // Define a clean handler for closing the event modal
  const handleCloseViewEventModal = () => {
    // Reset highlight and close modal immediately
    setHighlightCommentId(null);
    setShowViewEventModal(false);
    
    // If we were navigated here from a notification, clear location state
    if (location.state?.highlightEventId) {
      try {
        window.history.replaceState({}, document.title);
      } catch (error) {
        console.error('Failed to clear history state:', error);
      }
    }
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
            <div className="d-flex align-items-center">
              {/* Debug message */}
              {console.log('Rendering navbar, isAdmin:', isAdmin)}
              
              {/* RoleSwitcher component - always render but component will self-hide if not admin */}
              <RoleSwitcher 
                currentIsAdmin={effectiveIsAdmin}
                onRoleChange={handleRoleChange}
              />
              
              <NotificationBell />
              <Button variant="outline-light" onClick={onLogout} className="ms-2">Logout</Button>
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      
      <Container className="mt-4">
        <Tabs 
          activeKey={activeTab} 
          onSelect={setActiveTab} 
          className="mb-4"
          key={`tabs-${effectiveIsAdmin}`}
        >
          {/* Build tabs array dynamically based on user role */}
          {(() => {
            // Define all potential tabs
            const tabs = [
              // Map View tab - available to all users
              <Tab key="map-view" eventKey="map-view" title="Map View">
                <Row>
                  <Col md={3}>
                    <div className="sidebar-panel">
                      <h5 className="mb-3">Map Controls</h5>
                      
                      <div className="d-grid gap-2 mb-4">
                        <Button
                          variant="success"
                          onClick={handleAddEvent}
                        >
                          <i className="bi bi-pin-map me-2"></i>Add Event
                        </Button>
                      </div>
                      
                      <hr />
                      
                      <div className="map-info-section">
                        <h6>Current View</h6>
                        {selectedMap && (
                          <div className="current-map-info mb-3">
                            <p className="mb-1">
                              <strong>Main Map:</strong> {selectedMap.name}
                              {selectedMap.map_type === 'implantation' && (
                                <span className="badge bg-success ms-2">Primary</span>
                              )}
                            </p>
                            <p className="mb-1"><strong>Visible Layers:</strong> {visibleMapIds.length || 1}</p>
                            <p className="mb-0">
                              <strong>Events:</strong> {visibleEvents.length}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <hr />
                      
                      <div className="events-summary mb-3">
                        <h6>Event Categories</h6>
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
                        events={visibleEvents}
                        mode={effectiveIsAdmin ? 'edit' : 'view'}
                        onMapClick={handleMapClick}
                        isSelectingLocation={mapForEvent && mapForEvent.id === selectedMap.id}
                        onEventClick={handleViewEvent}
                        allMaps={maps.filter(m => m.project_id === project.id)}
                        projectId={project.id}
                        onVisibleMapsChanged={handleVisibleMapsChanged}
                      />
                    ) : (
                      <div className="text-center p-5 bg-light rounded">
                        <h3>No map selected</h3>
                        <p>Please select a map from the Project Maps tab or add a new one.</p>
                      </div>
                    )}
                  </Col>
                </Row>
              </Tab>,
              
              // Project Maps tab - admin only
              <Tab key="project-maps" eventKey="project-maps" title="Project Maps">
                <MapsManager 
                  projectId={project.id}
                  onMapUpdated={() => {
                    // Force reload the maps data when a map is updated
                    const refreshData = async () => {
                      try {
                        // Fetch fresh map data
                        const mapsData = await fetchMaps(parseInt(projectId, 10));
                        setMaps(mapsData);
                        
                        // Find and select the main map
                        const mainMap = mapsData.find(map => map.map_type === 'implantation');
                        if (mainMap) {
                          setSelectedMap(mainMap);
                          showNotification('Map updated successfully! Main map has been changed.', 'success');
                        }
                      } catch (error) {
                        console.error('Error refreshing maps after update:', error);
                        showNotification('Error updating maps. Please refresh the page.', 'error');
                      }
                    };
                    
                    refreshData();
                  }}
                />
              </Tab>,
              
              // Events tab - admin only
              <Tab key="events" eventKey="events" title="Events">
                <div className="mb-3 d-flex justify-content-between">
                  <h3>Project Events</h3>
                </div>
                
                <EventsTable 
                  events={events} 
                  onViewEvent={handleViewEvent}
                  onEditEvent={handleEditEvent}
                  onEventUpdated={handleEventUpdated}
                  effectiveIsAdmin={effectiveIsAdmin}
                />
              </Tab>,
              
              // Contacts tab - available to all users
              <Tab key="contacts" eventKey="contacts" title="Contacts">
                <ContactsTab 
                  projectId={parseInt(projectId)} 
                  effectiveIsAdmin={effectiveIsAdmin}
                />
              </Tab>
            ];
            
            // For members, only return the tabs they should see
            if (!effectiveIsAdmin) {
              return [tabs[0], tabs[3]]; // Map View and Contacts only
            }
            
            // For admins, return all tabs
            return tabs;
          })()}
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
        onHide={handleCloseViewEventModal}
        event={selectedEvent}
        allMaps={maps}
        onEventUpdated={handleEventUpdated}
        currentUser={currentUser}
        projectId={project?.id}
        effectiveIsAdmin={effectiveIsAdmin}
        highlightCommentId={highlightCommentId}
      />
      
      <EditEventModal
        show={showEditEventModal}
        onHide={() => setShowEditEventModal(false)}
        event={selectedEvent}
        onEventUpdated={handleEventUpdated}
        projectId={project?.id}
        userRole={effectiveIsAdmin ? "ADMIN" : "MEMBER"}
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