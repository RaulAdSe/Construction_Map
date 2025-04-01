import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import translate from '../utils/translate';

const DEBUG = false;

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
  
  // Create a state to store the current map visibility settings including opacities
  const [mapVisibilitySettings, setMapVisibilitySettings] = useState({});
  
  // Add a state variable for the comment to highlight
  const [highlightCommentId, setHighlightCommentId] = useState(null);
  
  // Add a state to track if user has manually closed the modal
  const [userClosedModal, setUserClosedModal] = useState(false);
  
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
          if (DEBUG) console.log('User admin status:', userIsAdmin);
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
    showNotification(`${translate('Viewing as')} ${newIsAdmin ? translate('Admin') : translate('Member')}`, 'info');
    
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
    if (DEBUG) console.log("Updated visible events:", filteredEvents.length, "out of", events.length);
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
      if (DEBUG) console.log("Selected map changed, ensuring it's visible:", selectedMap.id);
    }
  }, [selectedMap]);
  
  // Initialize visibleMapIds when maps are loaded
  useEffect(() => {
    if (maps.length > 0) {
      // Find the main map
      const mainMap = maps.find(map => map.map_type === 'implantation');
      
      if (mainMap) {
        // Initialize with the main map
        if (DEBUG) console.log("Initializing visible maps with main map:", mainMap.id);
        
        // Check if already in the list to avoid duplicates
        if (!visibleMapIds.includes(mainMap.id)) {
          setVisibleMapIds(prev => [mainMap.id, ...prev.filter(id => id !== mainMap.id)]);
        }
      }
    }
  }, [maps]);
  
  // Fix the handleVisibleMapsChanged function by using useCallback and preventing unnecessary updates
  const handleVisibleMapsChanged = useCallback((newVisibleMapIds, opacitySettings = {}) => {
    if (DEBUG) console.log("Visible maps changed to:", newVisibleMapIds);
    
    // Use functional updates to avoid stale state
    setVisibleMapIds(prevIds => {
      // Only update if the arrays are different
      if (JSON.stringify(prevIds) === JSON.stringify(newVisibleMapIds)) {
        return prevIds; // Return the previous state to prevent update
      }
      return newVisibleMapIds;
    });
    
    // Only update opacity settings if they've changed
    setMapVisibilitySettings(prevSettings => {
      // Check if the settings are different
      let hasChanged = false;
      for (const id in opacitySettings) {
        if (!prevSettings[id] || prevSettings[id].opacity !== opacitySettings[id].opacity) {
          hasChanged = true;
          break;
        }
      }
      
      if (!hasChanged && Object.keys(prevSettings).length === Object.keys(opacitySettings).length) {
        return prevSettings; // Return the previous state to prevent update
      }
      return opacitySettings;
    });
  }, []);
  
  // Create a formatted map settings object for the event
  const getActiveMapSettings = () => {
    const settings = {};
    visibleMapIds.forEach(id => {
      settings[id] = {
        opacity: mapVisibilitySettings[id] || 1.0
      };
    });
    return settings;
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
            if (DEBUG) console.log('Main map changed, updating selected map');
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
      
      // Attempt to find a main map (implantation type)
      const mainMap = mapsData.find(map => map.map_type === 'implantation');
      
      // If no main map is found but we have other maps, use the first one
      if (!mainMap && mapsData.length > 0) {
        setSelectedMap(mapsData[0]);
      } else if (mainMap) {
        setSelectedMap(mainMap);
      }
      
      // Set all events
      setEvents(allEvents);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading project data:', error);
      setLoading(false);
    }
  };
  
  const handleBackToProjects = () => {
    navigate('/projects');
  };
  
  const handleMapSelect = (mapId) => {
    const map = maps.find(m => m.id === mapId);
    if (map) setSelectedMap(map);
  };
  
  const handleAddMap = () => {
    setShowAddMapModal(true);
  };
  
  const handleMapAdded = (newMap) => {
    setShowAddMapModal(false);
    
    // Add the new map to our list
    setMaps(prevMaps => [...prevMaps, newMap]);
    
    // Select the new map
    setSelectedMap(newMap);
    
    // Add it to visible maps
    setVisibleMapIds(prev => [...prev, newMap.id]);
    
    // Show a success notification
    showNotification(translate('Map added successfully!'));
    
    // If this is the first map, let's switch to map-view tab
    if (maps.length === 0) {
      setActiveTab('map-view');
    }
  };
  
  const handleMapDeleted = (mapId) => {
    // Remove the map from our list
    setMaps(prevMaps => prevMaps.filter(m => m.id !== mapId));
    
    // If the deleted map was the selected map, select another map
    if (selectedMap && selectedMap.id === mapId) {
      const remainingMaps = maps.filter(m => m.id !== mapId);
      if (remainingMaps.length > 0) {
        // Prefer a main map if available
        const mainMap = remainingMaps.find(m => m.map_type === 'implantation');
        setSelectedMap(mainMap || remainingMaps[0]);
      } else {
        setSelectedMap(null);
      }
    }
    
    // Update visible maps
    setVisibleMapIds(prev => prev.filter(id => id !== mapId));
    
    // Show a success notification
    showNotification(translate('Map deleted successfully!'));
  };
  
  const handleAddEvent = () => {
    if (maps.length === 0) {
      showNotification(translate('Please add a map first.'), 'warning');
      return;
    }
    
    // If there's only one map, use it directly
    if (maps.length === 1) {
      setMapForEvent(maps[0]);
      setShowAddEventModal(true);
    } else {
      // Otherwise show the map selection modal
      setShowMapSelectionModal(true);
    }
  };
  
  const handleMapSelected = (mapId) => {
    setShowMapSelectionModal(false);
    const map = maps.find(m => m.id === mapId);
    if (map) {
      setMapForEvent(map);
      setShowAddEventModal(true);
    }
  };
  
  const handleMapClick = (map, x, y) => {
    // Only allow adding events if we're in the map-view tab
    if (activeTab !== 'map-view') return;
    
    setMapForEvent(map);
    setEventPosition({ x, y });
    setShowAddEventModal(true);
  };
  
  const handleEventAdded = (newEvent) => {
    setShowAddEventModal(false);
    
    // Update our events list
    setEvents(prevEvents => {
      const eventWithMapName = {
        ...newEvent,
        map_name: maps.find(m => m.id === newEvent.map_id)?.name || translate('Unknown Map')
      };
      return [...prevEvents, eventWithMapName];
    });
    
    // Show a success notification
    showNotification(translate('Event added successfully!'));
    
    // After adding an event, refresh the data
    loadProjectData(parseInt(projectId, 10));
  };
  
  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setShowViewEventModal(true);
    setUserClosedModal(false);
    
    // Reset highlight comment ID when opening a new event
    setHighlightCommentId(null);
    
    // Check if there's a comment ID in the URL to highlight
    const urlParams = new URLSearchParams(location.search);
    const commentId = urlParams.get('comment_id');
    if (commentId) {
      setHighlightCommentId(parseInt(commentId, 10));
    }
  };
  
  const handleEditEvent = (event) => {
    setSelectedEvent(event);
    setShowEditEventModal(true);
  };
  
  const handleEventUpdated = (updatedEvent) => {
    setShowEditEventModal(false);
    
    // Update our events list
    setEvents(prevEvents => {
      return prevEvents.map(event => 
        event.id === updatedEvent.id ? {
          ...updatedEvent,
          map_name: event.map_name // Preserve the map name
        } : event
      );
    });
    
    // Show a success notification
    showNotification(translate('Event updated successfully!'));
    
    // Reopen the view modal if it was open before
    if (showViewEventModal) {
      setSelectedEvent(updatedEvent);
    }
    
    // After updating an event, refresh the data
    loadProjectData(parseInt(projectId, 10));
  };
  
  const handleEventDeleted = (eventId) => {
    // Remove the event from our list
    setEvents(prevEvents => prevEvents.filter(e => e.id !== eventId));
    
    // Close the view modal if it's open
    setShowViewEventModal(false);
    
    // Show a success notification
    showNotification(translate('Event deleted successfully!'));
  };
  
  const handleViewModalClose = () => {
    setShowViewEventModal(false);
    setUserClosedModal(true);
    
    // Remove the comment_id query parameter from the URL
    if (location.search) {
      navigate(`/project/${projectId}`, { replace: true });
    }
  };
  
  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 5000);
  };
  
  // Function to handle tab changes and URL updates
  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    // No need to navigate on tab changes as we're using a single route
  };
  
  // Check for URL parameters on component mount
  useEffect(() => {
    if (location.pathname.includes('/project/')) {
      const searchParams = new URLSearchParams(location.search);
      
      // Handle event highlighting from URL params
      const eventId = searchParams.get('event_id');
      if (eventId && events.length > 0) {
        const eventToShow = events.find(e => e.id === parseInt(eventId, 10));
        if (eventToShow && !userClosedModal) {
          setSelectedEvent(eventToShow);
          setShowViewEventModal(true);
          
          // Check if there's a comment to highlight
          const commentId = searchParams.get('comment_id');
          if (commentId) {
            setHighlightCommentId(parseInt(commentId, 10));
          }
        }
      }
    }
  }, [location, events, projectId, userClosedModal]);
  
  // Set up a check for event_id when events are loaded
  useEffect(() => {
    const checkForHighlightedEvent = async () => {
      if (events.length > 0 && !loading) {
        const searchParams = new URLSearchParams(location.search);
        const eventId = searchParams.get('event_id');
        
        if (eventId && !userClosedModal) {
          const eventToShow = events.find(e => e.id === parseInt(eventId, 10));
          if (eventToShow) {
            setSelectedEvent(eventToShow);
            setShowViewEventModal(true);
            
            // Check if there's a comment to highlight
            const commentId = searchParams.get('comment_id');
            if (commentId) {
              setHighlightCommentId(parseInt(commentId, 10));
            }
          }
        }
      }
    };
    
    checkForHighlightedEvent();
  }, [events, loading, location.search, userClosedModal]);
  
  const renderLoadingIndicator = () => (
    <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
      <Spinner animation="border" role="status">
        <span className="visually-hidden">{translate('Loading...')}</span>
      </Spinner>
    </div>
  );
  
  // Create a keyboard handler for escape key
  const escapeKeyRef = useRef(null);
  
  useEffect(() => {
    // Define the handler function
    const handleEmergencyEscape = (e) => {
      if (e.key === 'Escape') {
        // Close all modals
        setShowAddMapModal(false);
        setShowAddEventModal(false);
        setShowMapSelectionModal(false);
        setShowViewEventModal(false);
        setShowEditEventModal(false);
        
        // Set userClosedModal to true to prevent reopening
        setUserClosedModal(true);
        
        // Remove any URL parameters
        if (location.search) {
          navigate(`/project/${projectId}`, { replace: true });
        }
      }
    };
    
    // Store the handler reference
    escapeKeyRef.current = handleEmergencyEscape;
    
    // Add the event listener
    document.addEventListener('keydown', handleEmergencyEscape);
    
    // Clean up
    return () => {
      document.removeEventListener('keydown', handleEmergencyEscape);
    };
  }, [projectId, location, navigate]);
  
  // Use location to get the comment_id query parameter
  const commentIdFromUrl = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const commentId = searchParams.get('comment_id');
    return commentId ? parseInt(commentId, 10) : null;
  }, [location.search]);
  
  // Function to calculate the percentage of events by status
  const calculateEventStats = () => {
    if (events.length === 0) {
      return { open: 0, inProgress: 0, resolved: 0, closed: 0 };
    }
    
    // Count events by status
    const counts = events.reduce((acc, event) => {
      const status = event.status.toLowerCase();
      
      if (status === 'open') acc.open++;
      else if (status === 'in-progress') acc.inProgress++;
      else if (status === 'resolved') acc.resolved++;
      else if (status === 'closed') acc.closed++;
      
      return acc;
    }, { open: 0, inProgress: 0, resolved: 0, closed: 0 });
    
    // Convert to percentages
    const total = events.length;
    return {
      open: Math.round((counts.open / total) * 100),
      inProgress: Math.round((counts.inProgress / total) * 100),
      resolved: Math.round((counts.resolved / total) * 100),
      closed: Math.round((counts.closed / total) * 100)
    };
  };
  
  const eventStats = calculateEventStats();
  
  if (loading) {
    return renderLoadingIndicator();
  }
  
  // Check if the project exists
  if (!project) {
    return (
      <Container>
        <Alert variant="danger" className="mt-4">
          {translate('Project not found')}. <Button variant="link" onClick={handleBackToProjects}>{translate('Back to Projects')}</Button>
        </Alert>
      </Container>
    );
  }
  
  // Check if there are maps available
  const noMaps = maps.length === 0;
  
  return (
    <div className="map-viewer-page">
      <Navbar bg="dark" variant="dark" expand="lg" className="project-navbar">
        <Container fluid>
          <Navbar.Brand>
            <Button variant="link" className="text-decoration-none text-light" onClick={handleBackToProjects}>
              <i className="bi bi-arrow-left me-2"></i>
              {translate('Construction Map Viewer')}
            </Button>
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="project-navbar-nav" />
          <Navbar.Collapse id="project-navbar-nav">
            <Nav className="me-auto">
              {project && (
                <Nav.Item className="project-title">
                  {project.name}
                </Nav.Item>
              )}
            </Nav>
            <div className="d-flex align-items-center">
              {isAdmin && (
                <RoleSwitcher 
                  isAdmin={effectiveIsAdmin} 
                  onRoleChange={handleRoleChange}
                />
              )}
              <NotificationBell projectId={projectId} />
              <Button variant="outline-light" onClick={onLogout} className="ms-3">
                {translate('Logout')}
              </Button>
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container fluid>
        <Tabs
          activeKey={activeTab}
          onSelect={handleTabChange}
          id="project-tabs"
          className="mb-3 mt-3"
        >
          <Tab eventKey="map-view" title={translate('Map View')}>
            <div className="map-view-container">
              {noMaps ? (
                <div className="text-center p-5 bg-light rounded">
                  <h3>{translate('No Maps Available')}</h3>
                  <p>{translate('This project doesn\'t have any maps yet. Add a map to get started!')}</p>
                  <Button variant="primary" onClick={handleAddMap} disabled={!effectiveIsAdmin}>
                    {translate('Add Map')}
                  </Button>
                </div>
              ) : (
                <Row>
                  <Col md={9}>
                    <div className="mb-3 d-flex justify-content-between align-items-center">
                      <h2>{translate('Project Map')}: {project.name}</h2>
                      <div className="d-flex gap-2">
                        <Button 
                          variant="outline-primary" 
                          onClick={handleAddEvent}
                          disabled={!effectiveIsAdmin}
                        >
                          <i className="bi bi-plus-circle me-1"></i> {translate('Add Event')}
                        </Button>
                        <Button 
                          variant="outline-secondary" 
                          onClick={handleAddMap}
                          disabled={!effectiveIsAdmin}
                        >
                          <i className="bi bi-map me-1"></i> {translate('Add Map')}
                        </Button>
                      </div>
                    </div>
                    
                    <div className="mt-2 mb-4 d-flex flex-wrap">
                      <div className="status-badge me-3 mb-2">
                        <span className="status-dot status-open"></span>
                        <span className="status-label">{translate('Open')}: {events.filter(e => e.status === 'open').length}</span>
                        <span className="status-percent">({eventStats.open}%)</span>
                      </div>
                      <div className="status-badge me-3 mb-2">
                        <span className="status-dot status-in-progress"></span>
                        <span className="status-label">{translate('In Progress')}: {events.filter(e => e.status === 'in-progress').length}</span>
                        <span className="status-percent">({eventStats.inProgress}%)</span>
                      </div>
                      <div className="status-badge me-3 mb-2">
                        <span className="status-dot status-resolved"></span>
                        <span className="status-label">{translate('Resolved')}: {events.filter(e => e.status === 'resolved').length}</span>
                        <span className="status-percent">({eventStats.resolved}%)</span>
                      </div>
                      <div className="status-badge mb-2">
                        <span className="status-dot status-closed"></span>
                        <span className="status-label">{translate('Closed')}: {events.filter(e => e.status === 'closed').length}</span>
                        <span className="status-percent">({eventStats.closed}%)</span>
                      </div>
                    </div>
                    
                    {selectedMap && (
                      <div className="map-container mb-3">
                        <MapDetail 
                          map={selectedMap}
                          visibleMapIds={visibleMapIds}
                          allMaps={maps}
                          events={visibleEvents}
                          onMapClick={handleMapClick}
                          onEventClick={handleEventClick}
                          onVisibleMapsChanged={handleVisibleMapsChanged}
                          visibilitySettings={mapVisibilitySettings}
                          isAdmin={effectiveIsAdmin}
                        />
                      </div>
                    )}
                  </Col>
                  <Col md={3}>
                    <div className="side-panel">
                      <h4>{translate('Recent Events')}</h4>
                      <div className="recent-events-list">
                        {events.length === 0 ? (
                          <p className="text-muted">{translate('No events yet')}</p>
                        ) : (
                          events
                            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                            .slice(0, 5)
                            .map(event => (
                              <div 
                                key={event.id} 
                                className="event-item"
                                onClick={() => handleEventClick(event)}
                              >
                                <div className="event-title">
                                  <span className={`status-indicator status-${event.status}`}></span>
                                  {event.title}
                                </div>
                                <div className="event-meta">
                                  <small>{translate('Map')}: {event.map_name}</small>
                                  <small>{new Date(event.created_at).toLocaleDateString()}</small>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                      
                      <h4 className="mt-4">{translate('Available Maps')}</h4>
                      <MapsManager 
                        maps={maps} 
                        selectedMapId={selectedMap?.id}
                        onMapSelect={handleMapSelect}
                        visibleMapIds={visibleMapIds}
                        onVisibleMapsChanged={handleVisibleMapsChanged}
                        visibilitySettings={mapVisibilitySettings}
                      />
                    </div>
                  </Col>
                </Row>
              )}
            </div>
          </Tab>
          
          {effectiveIsAdmin && (
            <Tab eventKey="project-maps" title={translate('Maps Management')}>
              <div className="map-list-container">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h2>{translate('Project Maps')}</h2>
                  <Button variant="primary" onClick={handleAddMap}>
                    <i className="bi bi-plus-lg"></i> {translate('Add New Map')}
                  </Button>
                </div>
                <MapList 
                  maps={maps} 
                  onMapSelect={handleMapSelect}
                  onMapDeleted={handleMapDeleted}
                  projectId={parseInt(projectId, 10)}
                  isAdmin={effectiveIsAdmin}
                />
              </div>
            </Tab>
          )}
          
          {effectiveIsAdmin && (
            <Tab eventKey="events" title={translate('Events')}>
              <div className="events-container">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h2>{translate('Events')}</h2>
                  <Button variant="primary" onClick={handleAddEvent}>
                    <i className="bi bi-plus-lg"></i> {translate('Add New Event')}
                  </Button>
                </div>
                <EventsTable 
                  events={events}
                  maps={maps}
                  onEventClick={handleEventClick}
                  onEventUpdated={handleEventUpdated}
                  onEventDeleted={handleEventDeleted}
                  projectId={parseInt(projectId, 10)}
                  isAdmin={effectiveIsAdmin}
                />
              </div>
            </Tab>
          )}
          
          <Tab eventKey="contacts" title={translate('Contacts')}>
            <ContactsTab 
              projectId={parseInt(projectId, 10)} 
              isAdmin={effectiveIsAdmin} 
            />
          </Tab>
        </Tabs>
      </Container>
      
      <Notification 
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification(prev => ({ ...prev, show: false }))}
      />
      
      <AddMapModal 
        show={showAddMapModal}
        onHide={() => setShowAddMapModal(false)}
        projectId={parseInt(projectId, 10)}
        onMapAdded={handleMapAdded}
      />
      
      <MapSelectionModal 
        show={showMapSelectionModal}
        onHide={() => setShowMapSelectionModal(false)}
        maps={maps}
        onMapSelected={handleMapSelected}
      />
      
      <AddEventModal 
        show={showAddEventModal}
        onHide={() => setShowAddEventModal(false)}
        mapId={mapForEvent?.id}
        position={eventPosition}
        onEventAdded={handleEventAdded}
        projectId={parseInt(projectId, 10)}
        allMaps={maps}
        visibleMaps={getActiveMapSettings()}
      />
      
      <EditEventModal 
        show={showEditEventModal}
        onHide={() => setShowEditEventModal(false)}
        event={selectedEvent}
        onEventUpdated={handleEventUpdated}
        projectId={parseInt(projectId, 10)}
        allMaps={maps}
      />
      
      <ViewEventModal 
        show={showViewEventModal}
        onHide={handleViewModalClose}
        event={selectedEvent}
        onEdit={handleEditEvent}
        onDeleted={handleEventDeleted}
        isAdmin={effectiveIsAdmin}
        projectId={parseInt(projectId, 10)}
        highlightCommentId={highlightCommentId}
        onEventUpdated={handleEventUpdated}
        maps={maps}
      />
      
      {/* Global event handler for refreshing data */}
      <div className="d-none">
        {(() => {
          window.refreshMapViewerData = () => {
            console.log("External refresh triggered");
            
            // Use a custom function to not show loading spinner
            const refreshData = async () => {
              try {
                // Fetch the specific project by ID
                const projectData = await fetchProjectById(parseInt(projectId, 10));
                setProject(projectData);
                
                // Fetch maps for the project
                const mapsData = await fetchMaps(parseInt(projectId, 10));
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
                
                // Set all events
                setEvents(allEvents);
                
                console.log("Data refreshed successfully");
              } catch (error) {
                console.error('Error refreshing data:', error);
              }
            };
            
            refreshData();
            return true;
          };
          
          return null;
        })()}
      </div>
    </div>
  );
};

export default MapViewer; 