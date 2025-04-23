import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Container, Row, Col, Button, Navbar, Nav, Spinner, Alert, Tabs, Tab, Offcanvas, Badge } from 'react-bootstrap';
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
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import MobileSwitcher from '../components/common/MobileSwitcher';
import MapEventTypeFilter from '../components/MapEventTypeFilter';
import { useMobile } from '../components/common/MobileProvider';
import { fetchMaps, performApiDiagnostics } from '../services/mapService';
import { projectService } from '../services/api';
import { fetchEvents } from '../services/eventService';
import { isUserAdmin } from '../utils/permissions';
import '../assets/styles/MapViewer.css';
import translate from '../utils/translate';
import { ensureHttps } from '../config';


const DEBUG = false;

const MapViewer = ({ onLogout }) => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useMobile();
  
  const [maps, setMaps] = useState([]);
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [filteredByTypeEvents, setFilteredByTypeEvents] = useState([]);
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
  
  // Add a state to control the default tab in view event modal
  const [activeEventModalTab, setActiveEventModalTab] = useState('details');
  
  // Add a state to track if user has manually closed the modal
  const [userClosedModal, setUserClosedModal] = useState(false);
  
  // Add a state for mobile sidebar visibility
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  
  // Keep track of original events for filtering
  const originalEventsRef = useRef([]);
  const previousFilterRef = useRef(null);
  
  // Use a simple integer counter for filter key instead of timestamp
  const [filterKey, setFilterKey] = useState(0);
  
  // Flag to track if events are currently being filtered
  const [isFiltering, setIsFiltering] = useState(false);
  
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
  
  // Update visible events whenever events or visible maps change
  useEffect(() => {
    // Skip this effect if no events or maps yet
    if (!events.length || !maps.length) return;

    // For debugging - log the count and types of events before filtering
    const beforeTypeCounts = {
      'incidence': events.filter(e => (e?.state || '').toLowerCase().includes('incidence')).length,
      'check': events.filter(e => {
        const state = (e?.state || '').toLowerCase();
        return state === 'periodic check' || 
               state === 'check' || 
               state.includes('check') || 
               state.includes('periodic');
      }).length,
      'request': events.filter(e => (e?.state || '').toLowerCase().includes('request')).length
    };
    console.log('Before map filtering - events by type:', beforeTypeCounts);
    
    // Store original events for filtering reference
    originalEventsRef.current = [...events];

    // Filter events based on visible maps
    const mapFilteredEvents = events.filter(event => {
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
    
    // Update filtered events with map-filtered events
    setFilteredEvents(mapFilteredEvents);
    
    // Also update type-filtered events with the same events
    // The type filter will be applied by MapEventTypeFilter
    setFilteredByTypeEvents(mapFilteredEvents);

    // Force map to refresh markers
    setFilterKey(prev => prev + 1);
    
    if (DEBUG) console.log("Updated map-filtered events:", mapFilteredEvents.length, "out of", events.length);
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
  
  // Reload map data when switching to Map View tab - with optimization
  useEffect(() => {
    if (activeTab === 'map-view' && projectId) {
      // We only want to reload the maps to get any updated main map
      const refreshMaps = async () => {
        // Don't refresh if we're already loading or if it's been less than 5s since last update
        const lastRefresh = sessionStorage.getItem(`last_map_refresh_${projectId}`);
        const now = Date.now();
        
        if (lastRefresh && (now - parseInt(lastRefresh, 10)) < 5000) {
          if (DEBUG) console.log('Skipping map refresh - throttled');
          return;
        }
        
        try {
          // Use cached data if available and recent
          const mapsCacheKey = `maps_cache_${projectId}`;
          const cachedMapsData = sessionStorage.getItem(mapsCacheKey);
          let mapsData;
          
          if (cachedMapsData && (now - JSON.parse(cachedMapsData).timestamp < 5000)) {
            // Use cached data
            mapsData = JSON.parse(cachedMapsData).data;
            if (DEBUG) console.log('Using cached maps data for tab switch');
          } else {
            // Fetch new data
            mapsData = await fetchMaps(parseInt(projectId, 10));
            
            // Update cache
            sessionStorage.setItem(mapsCacheKey, JSON.stringify({
              timestamp: now,
              data: mapsData
            }));
          }
          
          // Record last refresh time
          sessionStorage.setItem(`last_map_refresh_${projectId}`, now.toString());
          
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
    if (DEBUG) console.log(`Loading project data for project ID: ${pid}`);
      setLoading(true);
      
    try {
      // Load project details first
      const projectResponse = await projectService.getProject(pid);
      const projectData = projectResponse.data;
      
      if (DEBUG) console.log('Project data loaded:', projectData);
      setProject(projectData);
      
      // Then load maps for the project with forced HTTPS
      try {
        const mapsData = await fetchMaps(pid);
        if (DEBUG) console.log('Maps loaded:', mapsData);
      setMaps(mapsData);
      
        // Find main map (implantation type)
        const mainMap = mapsData.find(map => map.map_type === 'implantation');
      
        // Set the selected map - prefer main map, fall back to first map, or null if none
        const mapToSelect = mainMap || (mapsData.length > 0 ? mapsData[0] : null);
        setSelectedMap(mapToSelect);
        
        // Initialize visible maps with the main map
        if (mainMap) {
          setVisibleMapIds([mainMap.id]);
        }
        
        // Initialize map visibility settings
        const initialSettings = {};
        mapsData.forEach(map => {
          initialSettings[map.id] = { 
            visible: map.map_type === 'implantation', 
            opacity: 100
          };
        });
        setMapVisibilitySettings(initialSettings);
      } catch (mapError) {
        console.error('Error loading maps:', mapError);
        if (mapError.message && mapError.message.includes('Network Error')) {
          showNotification(translate('Error loading maps. Please check HTTPS security.'), 'danger');
      } else {
          showNotification(translate('Error loading maps'), 'warning');
        }
      }
      
      // Finally load events for the project
      try {
        const eventsData = await fetchEvents(pid);
        if (DEBUG) console.log('Events loaded:', eventsData);
        setEvents(eventsData);
      } catch (eventError) {
        console.error('Error loading events:', eventError);
        showNotification(translate('Error loading events'), 'warning');
      }
      
    } catch (error) {
      console.error('Error loading project data:', error);
      
      // More detailed error reporting
      if (error.message && error.message.includes('Network Error')) {
        showNotification(translate('Network error. This could be a HTTPS (mixed content) security issue.'), 'danger');
        
        // Run diagnostics
        console.log('Running API diagnostics to identify the issue...');
        performApiDiagnostics().then(results => {
          if (results.errors.length > 0) {
            console.error('API Diagnostics found issues:', results.errors);
            if (results.suggestions.length > 0) {
              console.info('Suggestions to fix:', results.suggestions);
              showNotification(translate('API connection issue: ' + results.suggestions[0]), 'warning');
            }
          }
        });
      } else if (error.response && error.response.status === 404) {
        showNotification(translate('Maps endpoint not found. API configuration issue.'), 'danger');
      } else if (error.response && error.response.status === 401) {
        showNotification(translate('Session expired. Please log in again.'), 'warning');
        // Force logout
        setTimeout(() => {
          if (typeof onLogout === 'function') onLogout();
        }, 2000);
      } else {
        showNotification(translate('Failed to load project data. Check console for details.'), 'danger');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Add a function to window that can be called from anywhere to refresh maps data
  window.refreshMapsData = async () => {
    if (projectId) {
      try {
        const now = Date.now();
        const mapsCacheKey = `maps_cache_${projectId}`;
        
        // Only fetch maps, not the entire project data
        console.log(`Refreshing maps data for project: ${projectId} (using HTTPS)`);
        
        // Make sure projectId is treated as a number
        const mapsData = await fetchMaps(parseInt(projectId, 10));
        
        // Update the cache
        sessionStorage.setItem(mapsCacheKey, JSON.stringify({
          timestamp: now,
          data: mapsData
        }));
        
        // Record last refresh time
        sessionStorage.setItem(`last_map_refresh_${projectId}`, now.toString());
        
        setMaps(mapsData);
        showNotification(translate('Maps updated successfully!'), 'success');
      } catch (error) {
        console.error('Error refreshing maps:', error);
        
        // Check for mixed content errors
        if (error.message && error.message.includes('Network Error')) {
          console.error('Network error detected - possibly a mixed content issue. Check HTTPS.');
          showNotification(translate('Network error. Please check HTTPS security.'), 'danger');
        } else {
        showNotification(translate('Error refreshing maps data.'), 'error');
        }
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
      showNotification(translate('No project selected.'), 'error');
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
      
      showNotification(translate('Map updated successfully!'));
    } else {
      // Add new map
      setMaps([...maps, newMap]);
      setSelectedMap(newMap);
      showNotification(translate('Map added successfully!'));
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
    
    showNotification(translate('Map deleted successfully!'));
  };
  
  const handleAddEvent = () => {
    console.log('MapViewer: handleAddEvent called, isMobile=', isMobile);
    
    if (!selectedMap) {
      console.log('MapViewer: No map selected, cannot add event');
      showNotification(translate('Please select a map first before adding an event.'), 'warning');
      // Maybe direct them to map selection
      setActiveTab('project-maps');
      return;
    }
    
    console.log('MapViewer: Starting event creation process with map:', selectedMap?.id);
    
    // Close any open sidebar or overlays
    setShowMobileSidebar(false);
    
    // For mobile, add a slight delay to ensure UI updates before entering selection mode
    if (isMobile) {
      // Clearer instructions specific to mobile
      showNotification(translate('Tap directly on the map to place your event. Tap the Cancel button to cancel.'), 'info', 5000);
      
      // Use timeout to ensure UI is ready for selection
      setTimeout(() => {
        // Store reference to map and set selecting location mode
        setMapForEvent(selectedMap);
        
        // Add a class to the root element to hide the nav bar while selecting location
        document.body.classList.add('map-adding-event');
        
        console.log('MapViewer: Mobile event creation mode activated');
      }, 200); // Increased delay for better reliability
    } else {
      // Desktop flow - immediate activation
      // Store reference to map and set selecting location mode
      setMapForEvent(selectedMap);
      
      // Add a class to the root element to hide the nav bar while selecting location
      document.body.classList.add('map-adding-event');
      
      // Notify user to click on the map
      showNotification(translate('Click on the map to place your event or press ESC to cancel.'), 'info');
    }
  };
  
  // Cancel location selection mode
  const cancelLocationSelection = () => {
    setMapForEvent(null);
    document.body.classList.remove('map-adding-event');
    showNotification(translate('Event location selection cancelled.'), 'info');
  };

  // Handle escape key to cancel location selection
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && mapForEvent) {
        cancelLocationSelection();
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [mapForEvent]);

  // Handle browser back button
  useEffect(() => {
    const handleBackButton = (event) => {
      if (mapForEvent) {
        event.preventDefault();
        cancelLocationSelection();
      }
    };

    window.addEventListener('popstate', handleBackButton);
    return () => {
      window.removeEventListener('popstate', handleBackButton);
    };
  }, [mapForEvent]);

  const handleMapSelected = (mapId) => {
    const map = maps.find(m => m.id === mapId);
    setMapForEvent(map);
    setShowMapSelectionModal(false);
    showNotification(translate('Click on the map to place your event.'), 'info');
  };
  
  const handleMapClick = (map, x, y) => {
    console.log(`MapViewer: handleMapClick called with coordinates (${x}, ${y}), isMobile=${isMobile}, mapForEvent=${!!mapForEvent}`);
    
    if (mapForEvent && mapForEvent.id === map.id) {
      console.log('MapViewer: Setting event position and preparing to show modal');
      setEventPosition({ x, y });
      setMapForEvent(prev => {
        console.log('MapViewer: Updating mapForEvent with visible maps', map.visibleMaps || []);
        return {
          ...prev,
          visibleMaps: map.visibleMaps || []
        };
      });
      
      // Add small delay on mobile to ensure event coordinates are processed
      if (isMobile) {
        console.log('MapViewer: Mobile view - adding slight delay before showing modal');
        setTimeout(() => {
          setShowAddEventModal(true);
          document.body.classList.remove('map-adding-event');
        }, 50);
      } else {
        setShowAddEventModal(true);
        document.body.classList.remove('map-adding-event');
      }
    } else {
      console.log('MapViewer: Map click ignored - not in event creation mode or wrong map');
      console.log('MapForEvent:', mapForEvent);
      console.log('Clicked map:', map);
    }
  };
  
  const handleEventAdded = (newEvent) => {
    // Add map name to the event for display
    const mapName = maps.find(m => m.id === newEvent.map_id)?.name || '';
    const eventWithMapName = { ...newEvent, map_name: mapName };
    
    setEvents([...events, eventWithMapName]);
    setMapForEvent(null);
    showNotification(translate('Event added successfully!'));
    setShowAddEventModal(false);
  };
  
  const handleViewEvent = useCallback((event) => {
    // Only update state if we're actually changing events
    if (!selectedEvent || selectedEvent.id !== event.id) {
      // Reset highlight comment when manually selecting an event
      setHighlightCommentId(null);
      
      // Update the selected event
      setSelectedEvent(event);
      
      // Set show modal
      setShowViewEventModal(true);
      
      // Reset user closed flag
      setUserClosedModal(false);
    } else if (!showViewEventModal) {
      // If the same event, but modal is closed, just show the modal
      setShowViewEventModal(true);
      setUserClosedModal(false);
    }
  }, [selectedEvent, showViewEventModal]);
  
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
    
    // Force a deep clone to ensure React detects the change
    const updatedEventsCopy = JSON.parse(JSON.stringify(
      events.map(event => event.id === updatedEvent.id ? eventWithMapName : event)
    ));
    
    // Set the events state with the new array
    setEvents(updatedEventsCopy);
    
    // Show notification about the update
    showNotification(translate('Event updated successfully!'));
    
    // If we updated the currently selected event, also update it directly
    // This ensures the ViewEventModal shows the updated values immediately
    if (selectedEvent && selectedEvent.id === updatedEvent.id) {
      // Create a new object to ensure React detects the change
      const updatedSelectedEvent = { 
        ...selectedEvent, 
        ...updatedEvent,
        status: updatedEvent.status, // Explicitly update these fields
        state: updatedEvent.state 
      };
      setSelectedEvent(updatedSelectedEvent);
    }
    
    // Force update visibleEvents to reflect changes
    // This will trigger a rerender of the EventMarker components
    const updatedVisibleEvents = filteredEvents.map(event => {
      if (event.id === updatedEvent.id) {
        return { ...event, ...updatedEvent };
      }
      return event;
    });
    setFilteredEvents(updatedVisibleEvents);
  };
  
  const showNotification = (message, type = 'success', duration = 3000) => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ ...notification, show: false });
    }, duration);
  };
  
  // Add a debug function to check and fix admin status
  window.debugAdmin = () => {
    try {
      // Check current localStorage
      const token = localStorage.getItem('token');
      const userJson = localStorage.getItem('user');
      if (DEBUG) {
        console.log('Current token:', token);
        console.log('Current user data:', userJson);
      }
      
      // Try to decode the token
      if (token) {
        const tokenPayload = JSON.parse(atob(token.split('.')[1]));
        if (DEBUG) {
          console.log('Token payload:', tokenPayload);
        }
        
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
          if (DEBUG) console.log('Created user data:', user);
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
      // Skip if the user has manually closed the modal
      if (userClosedModal) return;
      
      // Skip if we're in the middle of loading data to prevent cascading API calls
      if (loading) return;
      
      // Use local variable to track if we need to update maps
      let shouldUpdateSelectedMap = false;
      let mapToSelect = null;
      let shouldShowModal = false;
      let eventToShow = null;
      let commentToHighlight = null;
      
      // Check if we have highlight info in location state (from programmatic navigation)
      const highlightEventId = location.state?.highlightEventId;
      const highlightCommentId = location.state?.highlightCommentId;
      
      // If we have an event to highlight from the state
      if (highlightEventId && events.length > 0) {
        if (DEBUG) console.log(`Highlighting event ${highlightEventId} from notification navigation`);
        
        // Find the event
        const eventToHighlight = events.find(e => e.id === parseInt(highlightEventId, 10));
        
        if (eventToHighlight) {
          // Select the event's map
          const eventMap = maps.find(m => m.id === eventToHighlight.map_id);
          if (eventMap) {
            shouldUpdateSelectedMap = true;
            mapToSelect = eventMap;
          }
          
          // Set the event to show in modal
          shouldShowModal = true;
          eventToShow = eventToHighlight;
          
          // Store the comment ID for highlighting
          if (highlightCommentId) {
            commentToHighlight = parseInt(highlightCommentId, 10);
          }
          
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
      
      if (eventIdFromUrl && events.length > 0 && !shouldShowModal) {
        if (DEBUG) console.log(`Highlighting event ${eventIdFromUrl} from URL parameters`);
        
        // Find the event
        const eventToHighlight = events.find(e => e.id === parseInt(eventIdFromUrl, 10));
        
        if (eventToHighlight) {
          // Select the event's map
          const eventMap = maps.find(m => m.id === eventToHighlight.map_id);
          if (eventMap) {
            shouldUpdateSelectedMap = true;
            mapToSelect = eventMap;
          }
          
          // Set the event to show in modal
          shouldShowModal = true;
          eventToShow = eventToHighlight;
          
          // If we have a comment to highlight, set it
          if (commentIdFromUrl) {
            commentToHighlight = parseInt(commentIdFromUrl, 10);
            
            // Also set the active tab to comments
            setActiveEventModalTab('comments');
          }
          
          // Remove the parameters from the URL to prevent issues on refresh
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        }
      }
      
      // Batch state updates to prevent cascading renders
      if (shouldUpdateSelectedMap && mapToSelect) {
        setSelectedMap(mapToSelect);
        
        // Make sure this map is visible
        if (!visibleMapIds.includes(mapToSelect.id)) {
          setVisibleMapIds(prev => [...prev, mapToSelect.id]);
        }
      }
      
      if (shouldShowModal && eventToShow) {
        setSelectedEvent(eventToShow);
        if (commentToHighlight !== null) {
          setHighlightCommentId(commentToHighlight);
        }
        setShowViewEventModal(true);
      }
    };
    
    // Only run this effect after events are loaded and we're not in a loading state
    if (events.length > 0 && !loading) {
      checkForHighlightedEvent();
    }
  }, [events, maps, location.state, loading, userClosedModal, visibleMapIds]);
  
  const handleCloseViewEventModal = useCallback(() => {
    // Reset state
    setShowViewEventModal(false);
    setHighlightCommentId(null);
    
    // Only reset selected event after the modal is closed
    // This prevents trying to render with a null event while the modal is still closing
    setTimeout(() => {
      setSelectedEvent(null);
    }, 100);
    
    // Set user closed flag to prevent reopening
    setUserClosedModal(true);
    
    // If we were navigated here from a notification, clear location state
    try {
      if (location.state?.highlightEventId) {
        window.history.replaceState({}, document.title);
      }
    } catch (error) {
      console.error('Failed to clean up location state:', error);
    }
  }, [location.state]);
  
  // Add a global emergency escape handler
  useEffect(() => {
    let escapeCount = 0;
    let escapeTimer = null;

    const handleEmergencyEscape = (e) => {
      if (e.key === 'Escape') {
        escapeCount++;
        
        // If user presses Escape twice within 500ms, close any modals safely
        if (escapeCount === 1) {
          escapeTimer = setTimeout(() => {
            escapeCount = 0;
          }, 500);
        } else if (escapeCount >= 2) {
          if (DEBUG) console.log('EMERGENCY ESCAPE: Closing modals properly');
          
          // Close all modals using their React state handlers
          setShowViewEventModal(false);
          setHighlightCommentId(null);
          setSelectedEvent(null);
          setUserClosedModal(true);
          setShowEditEventModal(false);
          setShowAddMapModal(false);
          setShowAddEventModal(false);
          setShowMapSelectionModal(false);
          
          // Clear location state to prevent getting stuck in a highlight loop
          window.history.replaceState({}, document.title);
          
          // Reset counter
          escapeCount = 0;
          clearTimeout(escapeTimer);
        }
      }
    };

    document.addEventListener('keydown', handleEmergencyEscape);
    
    return () => {
      document.removeEventListener('keydown', handleEmergencyEscape);
      clearTimeout(escapeTimer);
    };
  }, []);
  
  // Reset the userClosedModal flag when project changes
  useEffect(() => {
    setUserClosedModal(false);
  }, [projectId]);
  
  // Add a global function to reset the userClosedModal flag
  useEffect(() => {
    window.resetModalClosedFlag = () => {
      if (DEBUG) console.log('Resetting userClosedModal flag for notification navigation');
      setUserClosedModal(false);
    };
    
    return () => {
      delete window.resetModalClosedFlag;
    };
  }, []);
  
  // Memoize the ViewEventModal props to prevent unnecessary rerenders
  const viewEventModalProps = useMemo(() => ({
    show: showViewEventModal,
    onHide: handleCloseViewEventModal,
    event: selectedEvent,
    allMaps: maps,
    onEventUpdated: handleEventUpdated,
    currentUser: currentUser,
    projectId: project?.id,
    effectiveIsAdmin: effectiveIsAdmin,
    highlightCommentId: highlightCommentId,
    activeTab: activeEventModalTab
  }), [
    showViewEventModal,
    handleCloseViewEventModal,
    selectedEvent,
    maps,
    handleEventUpdated,
    currentUser,
    project?.id,
    effectiveIsAdmin,
    highlightCommentId,
    activeEventModalTab
  ]);
  
  // Handle event type filter change 
  const handleEventTypeFilterChange = useCallback((typeFilteredEvents) => {
    // Skip update if no events provided
    if (!typeFilteredEvents || !Array.isArray(typeFilteredEvents)) {
      console.log('No type-filtered events provided to MapViewer');
      return;
    }
    
    // Debug logs
    console.log(`MapViewer received ${typeFilteredEvents.length} type-filtered events`);
    
    // Compare arrays by id to prevent unnecessary updates
    if (filteredByTypeEvents.length === typeFilteredEvents.length) {
      const currentIds = new Set(filteredByTypeEvents.map(e => e.id));
      const newIds = new Set(typeFilteredEvents.map(e => e.id));
      
      if (currentIds.size === newIds.size && 
          [...newIds].every(id => currentIds.has(id))) {
        console.log('Skipping update - type-filtered events have not changed');
        return;
      }
    }
    
    console.log(`Type filter changed: now showing ${typeFilteredEvents.length} events`);
    
    // Create deep copies to ensure references are different
    const cleanFilteredEvents = JSON.parse(JSON.stringify(typeFilteredEvents));
    
    // Update only the type-filtered events state
    setFilteredByTypeEvents(cleanFilteredEvents);
    
    // Increment filter key to trigger re-render of markers
    setFilterKey(prev => {
      const newKey = prev + 1;
      console.log(`Incrementing filter key from ${prev} to ${newKey}`);
      return newKey;
    });
  }, [filteredByTypeEvents]);
  
  // Force markers to update when events change by adding a key based on selection
  const mapEventKey = useMemo(() => {
    return filterKey; // Use the filter key to force rerenders
  }, [filterKey]);
  
  // Make MapDetail take an eventKey prop to force redraw of markers
  const mapDetailProps = useMemo(() => ({
    map: selectedMap,
    events: filteredByTypeEvents,
    eventKey: mapEventKey, // Add key for forcing rerenders
    onMapClick: handleMapClick,
    isSelectingLocation: mapForEvent && mapForEvent.id === selectedMap.id,
    onEventClick: handleViewEvent,
    allMaps: maps,
    projectId: projectId,
    onVisibleMapsChanged: handleVisibleMapsChanged
  }), [selectedMap, filteredByTypeEvents, mapEventKey, handleMapClick, mapForEvent, handleViewEvent, maps, projectId, handleVisibleMapsChanged]);
  
  // Create a toggle function for the mobile sidebar
  const toggleMobileSidebar = () => {
    setShowMobileSidebar(!showMobileSidebar);
  };
  
  // Render a mobile-optimized navbar
  const renderNavbar = () => {
    if (isMobile) {
      return (
        <Navbar bg="dark" variant="dark" expand="lg" className="mobile-navbar py-2">
          <Container fluid>
            <Button 
              variant="outline-light" 
              className="me-2 mobile-menu-btn" 
              onClick={toggleMobileSidebar}
              aria-label="Toggle sidebar"
            >
              <i className="bi bi-list"></i>
            </Button>
            <Navbar.Brand onClick={handleBackToProjects} style={{ cursor: 'pointer', fontSize: '1rem' }}>
              {project?.name || translate('Construction Map Viewer')}
            </Navbar.Brand>
            <div className="d-flex align-items-center">
              <RoleSwitcher 
                currentIsAdmin={effectiveIsAdmin}
                onRoleChange={handleRoleChange}
              />
              <NotificationBell />
              <LanguageSwitcher />
              <MobileSwitcher />
            </div>
          </Container>
        </Navbar>
      );
    }
    
    // Default desktop navbar
    return (
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand onClick={handleBackToProjects} style={{ cursor: 'pointer' }}>
            {translate('Construction Map Viewer')}
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Item>
                <Nav.Link onClick={handleBackToProjects}>
                  &laquo; {translate('Back to Projects')}
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link active>
                  {translate('Project')}: {project.name}
                </Nav.Link>
              </Nav.Item>
            </Nav>
            <div className="d-flex align-items-center">
              <RoleSwitcher 
                currentIsAdmin={effectiveIsAdmin}
                onRoleChange={handleRoleChange}
              />
              <NotificationBell />
              <LanguageSwitcher />
              <MobileSwitcher />
              <Button variant="outline-light" onClick={onLogout} className="ms-2">{translate('Logout')}</Button>
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    );
  };
  
  // Render the mobile sidebar with controls
  const renderMobileSidebar = () => {
    return (
      <Offcanvas 
        show={showMobileSidebar} 
        onHide={() => setShowMobileSidebar(false)} 
        placement="start"
        className="mobile-sidebar"
        style={{ zIndex: 1080 }}
        backdrop={false}
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>{translate('Map Controls')}</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <Tabs 
            activeKey={activeTab} 
            onSelect={(key) => {
              setActiveTab(key);
              if (isMobile) setShowMobileSidebar(false);
            }} 
            className="mb-3"
          >
            <Tab eventKey="map-view" title={translate('Map')}>
              <div className="d-grid gap-2 mb-3">
                <Button
                  variant="success"
                  onClick={() => {
                    handleAddEvent();
                    setShowMobileSidebar(false);
                  }}
                >
                  <i className="bi bi-pin-map me-2"></i>{translate('Add Event')}
                </Button>
              </div>
              
              <hr />
              
              <div className="map-info-section">
                <h6>{translate('Current View')}</h6>
                {selectedMap && (
                  <div className="current-map-info mb-3">
                    <p className="mb-1">
                      <strong>{translate('Main Map')}:</strong> {selectedMap.name}
                      {selectedMap.map_type === 'implantation' && (
                        <span className="badge bg-success ms-2">{translate('Primary')}</span>
                      )}
                    </p>
                    <p className="mb-1"><strong>{translate('Visible Layers')}:</strong> {visibleMapIds.length || 1}</p>
                    <p className="mb-0">
                      <strong>{translate('Events')}:</strong> {filteredByTypeEvents.length}
                    </p>
                  </div>
                )}
              </div>
              
              <hr />
              
              <div className="events-summary mb-3">
                <h6>{translate('Event Categories')}</h6>
                <ul className="list-unstyled">
                  {Array.from(new Set(events.flatMap(e => e.tags || []))).map(tag => (
                    <li key={tag} className="mb-1">
                      <span className="badge bg-secondary me-2">{tag}</span>
                      <span>{events.filter(e => e.tags?.includes(tag)).length}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <hr />
              
              <Button variant="secondary" onClick={handleBackToProjects} className="w-100 mb-2">
                {translate('Back to Projects')}
              </Button>
              <Button variant="outline-danger" onClick={onLogout} className="w-100">
                {translate('Logout')}
              </Button>
            </Tab>
            
            {effectiveIsAdmin && (
              <Tab eventKey="project-maps" title={translate('Maps')}>
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
                          showNotification(translate('Map updated successfully! Main map has been changed.'), 'success');
                        }
                      } catch (error) {
                        console.error('Error refreshing maps after update:', error);
                        showNotification(translate('Error updating maps. Please refresh the page.'), 'error');
                      }
                    };
                    
                    refreshData();
                  }}
                />
              </Tab>
            )}
            
            {effectiveIsAdmin && (
              <Tab eventKey="events" title={translate('Events')}>
                <div className="mb-3 d-flex justify-content-between">
                  <h5>{translate('Project Events')}</h5>
                </div>
                
                <EventsTable 
                  events={filteredByTypeEvents} 
                  onViewEvent={(event) => {
                    handleViewEvent(event);
                    setShowMobileSidebar(false);
                  }}
                  onEditEvent={(event) => {
                    handleEditEvent(event);
                    setShowMobileSidebar(false);
                  }}
                  onEventUpdated={handleEventUpdated}
                  effectiveIsAdmin={effectiveIsAdmin}
                />
              </Tab>
            )}
            
            <Tab eventKey="contacts" title={translate('Contacts')}>
              <ContactsTab 
                projectId={parseInt(projectId)} 
                effectiveIsAdmin={effectiveIsAdmin}
              />
            </Tab>
          </Tabs>
        </Offcanvas.Body>
      </Offcanvas>
    );
  };
  
  // Render map view content
  const renderMapViewContent = () => {
    // For mobile, use full width
    if (isMobile) {
      return (
        <div className="mobile-map-container">
          {selectedMap ? (
            <>
              {/* Show filter at the top of the map container for mobile */}
              <div className="mobile-filter-container" style={{
                position: 'absolute', 
                top: '15px', 
                left: '50%', 
                transform: 'translateX(-50%)',
                zIndex: 2000,
                maxWidth: '100%',
                padding: '0 10px',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                borderRadius: '6px',
                boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)'
              }}>
                <MapEventTypeFilter 
                  mapFilteredEvents={filteredEvents} 
                  allEvents={originalEventsRef.current} 
                  onFilterChange={handleEventTypeFilterChange} 
                />
              </div>
              <MapDetail 
                map={selectedMap}
                events={filteredByTypeEvents}
                eventKey={mapEventKey}
                onMapClick={handleMapClick}
                isSelectingLocation={mapForEvent && mapForEvent.id === selectedMap.id}
                onEventClick={handleViewEvent}
                allMaps={maps}
                projectId={projectId}
                onVisibleMapsChanged={handleVisibleMapsChanged}
              />
            </>
          ) : (
            <div className="text-center p-3 bg-light rounded">
              <h5>{translate('No map selected')}</h5>
              <p className="small">{translate('Please select a map from the Project Maps tab or add a new one.')}</p>
              <Button size="sm" variant="primary" onClick={toggleMobileSidebar}>
                {translate('Open Maps')}
              </Button>
            </div>
          )}
          
          {/* Cancel overlay for location selection mode */}
          {mapForEvent && (
            <div className="selecting-location-cancel-overlay">
              <Button 
                variant="danger" 
                size="sm"
                className="cancel-selection-btn"
                onClick={(e) => {
                  // Make sure to stop propagation to prevent any parent handlers
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('MapViewer: Cancel button clicked explicitly');
                  cancelLocationSelection();
                }}
              >
                <i className="bi bi-x-lg me-1"></i>
                {translate('Cancel')}
              </Button>
            </div>
          )}
          
          {/* Add Event button in left side for mobile view */}
          {selectedMap && !mapForEvent && (
            <Button 
              className="add-event-fab"
              variant="success"
              onClick={() => {
                console.log('MapViewer: Mobile FAB Add Event button clicked');
                handleAddEvent();
              }}
              aria-label={translate('Add Event')}
              style={{
                position: 'fixed',
                left: '15px',
                bottom: '90px',  // Higher position, well above tab navigation
                zIndex: 1000
              }}
            >
              <i className="bi bi-plus-lg"></i>
            </Button>
          )}
          
          {/* Add mobile tab navigation */}
          <div className="tab-navigation">
            <div 
              className={`tab-button ${activeTab === 'map-view' ? 'active' : ''}`}
              onClick={() => setActiveTab('map-view')}
            >
              <i className="bi bi-map"></i>
              <span>{translate('Map')}</span>
            </div>
            
            {effectiveIsAdmin && (
              <div 
                className={`tab-button ${activeTab === 'events' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('events');
                  toggleMobileSidebar();
                }}
              >
                <i className="bi bi-pin-map"></i>
                <span>{translate('Events')}</span>
              </div>
            )}
            
            {effectiveIsAdmin && (
              <div 
                className={`tab-button ${activeTab === 'project-maps' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('project-maps');
                  toggleMobileSidebar();
                }}
              >
                <i className="bi bi-layers"></i>
                <span>{translate('Maps')}</span>
              </div>
            )}
            
            <div 
              className={`tab-button ${activeTab === 'contacts' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('contacts');
                toggleMobileSidebar();
              }}
            >
              <i className="bi bi-people"></i>
              <span>{translate('Contacts')}</span>
            </div>
          </div>
        </div>
      );
    }
    
    // For desktop, update the layout to maximize map space
    return (
      <Row className="map-content-container g-0">
        <Col xs={12} className="position-relative map-content-area p-0">
          {/* Show filter at the top-right corner of the map area for desktop */}
          <div className="desktop-filter-container">
            <MapEventTypeFilter 
              mapFilteredEvents={filteredEvents} 
              allEvents={originalEventsRef.current} 
              onFilterChange={handleEventTypeFilterChange} 
            />
          </div>
        
          {selectedMap ? (
            <>
              {/* Add event button for desktop view at top left */}
              {!mapForEvent && (
                <Button
                  variant="success"
                  className="add-event-btn"
                  onClick={handleAddEvent}
                  style={{
                    position: 'absolute',
                    top: '15px',
                    left: '15px',
                    zIndex: 1000
                  }}
                >
                  <i className="bi bi-pin-map me-2"></i>
                  {translate('Add Event')}
                </Button>
              )}
              
              <MapDetail 
                map={selectedMap}
                events={filteredByTypeEvents}
                eventKey={mapEventKey}
                onMapClick={handleMapClick}
                isSelectingLocation={mapForEvent && mapForEvent.id === selectedMap.id}
                onEventClick={handleViewEvent}
                allMaps={maps}
                projectId={projectId}
                onVisibleMapsChanged={handleVisibleMapsChanged}
              />
              
              {/* Cancel overlay for desktop view */}
              {mapForEvent && (
                <div className="selecting-location-message">
                  <Alert variant="info" className="py-2 px-3 m-0">
                    <small>
                      <i className="bi bi-info-circle me-2"></i>
                      {translate('Click on the map to place your event or press ESC to cancel.')}
                    </small>
                  </Alert>
                </div>
              )}
            </>
          ) : (
            <div className="no-map-selected text-center p-5 bg-light rounded">
              <h3>{translate('No map selected')}</h3>
              <p>{translate('Please select a map from the list or add a new one.')}</p>
            </div>
          )}
        </Col>
      </Row>
    );
  };
  
  const handleHideAddEventModal = () => {
    setShowAddEventModal(false);
    setMapForEvent(null);
    
    // Ensure the class is removed when the modal is closed
    document.body.classList.remove('map-adding-event');
  };
  
  // Add an effect for handling fetched events - make sure we store them in the ref
  useEffect(() => {
    // Store original events for filtering - this ensures we always filter from the complete set
    originalEventsRef.current = [...events];
    
    if (DEBUG) {
      console.log(`Stored ${events.length} events in originalEventsRef for later filtering`);
    }
  }, [events]);
  
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">{translate('Loading...')}</span>
        </Spinner>
      </div>
    );
  }
  
  if (!project) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">
          {translate('Project not found or you don\'t have access.')}
          <Button variant="link" onClick={handleBackToProjects}>
            {translate('Back to Projects')}
          </Button>
        </Alert>
      </Container>
    );
  }
  
  return (
    <div className={`map-viewer ${isMobile ? 'mobile-view has-tab-navigation' : ''}`}>
      {renderNavbar()}
      
      {/* For mobile, render the sidebar as an offcanvas */}
      {isMobile && renderMobileSidebar()}
      
      <Container fluid={true} className={isMobile ? "p-0 mt-0" : "p-0 mt-2"}>
        {/* For desktop, render tabs as normal */}
        {!isMobile && (
          <Tabs 
            activeKey={activeTab} 
            onSelect={setActiveTab} 
            className="mb-2 mx-2"
            key={`tabs-${effectiveIsAdmin}`}
          >
            {/* Map View tab - available to all users */}
            <Tab eventKey="map-view" title={translate('Map View')}>
              {renderMapViewContent()}
            </Tab>
            
            {/* Project Maps tab - admin only */}
            {effectiveIsAdmin && (
              <Tab eventKey="project-maps" title={translate('Project Maps')}>
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
                          showNotification(translate('Map updated successfully! Main map has been changed.'), 'success');
                        }
                      } catch (error) {
                        console.error('Error refreshing maps after update:', error);
                        showNotification(translate('Error updating maps. Please refresh the page.'), 'error');
                      }
                    };
                    
                    refreshData();
                  }}
                />
              </Tab>
            )}
            
            {/* Events tab - admin only */}
            {effectiveIsAdmin && (
              <Tab eventKey="events" title={translate('Events')}>
                <div className="mb-3 d-flex justify-content-between">
                  <h3>{translate('Project Events')}</h3>
                </div>
                
                <EventsTable 
                  events={filteredByTypeEvents} 
                  onViewEvent={handleViewEvent}
                  onEditEvent={handleEditEvent}
                  onEventUpdated={handleEventUpdated}
                  effectiveIsAdmin={effectiveIsAdmin}
                />
              </Tab>
            )}
            
            {/* Contacts tab - available to all users */}
            <Tab eventKey="contacts" title={translate('Contacts')}>
              <ContactsTab 
                projectId={parseInt(projectId)} 
                effectiveIsAdmin={effectiveIsAdmin}
              />
            </Tab>
          </Tabs>
        )}
        
        {/* For mobile, render content directly */}
        {isMobile && renderMapViewContent()}
      </Container>
      
      {/* Modals */}
      <AddMapModal 
        show={showAddMapModal} 
        onHide={() => setShowAddMapModal(false)} 
        onMapAdded={handleMapAdded}
        projectId={project?.id}
        fullscreen={isMobile}
      />
      
      <MapSelectionModal 
        show={showMapSelectionModal}
        onHide={() => setShowMapSelectionModal(false)}
        maps={maps}
        onMapSelected={handleMapSelected}
        fullscreen={isMobile}
      />
      
      <AddEventModal
        show={showAddEventModal}
        onHide={handleHideAddEventModal}
        mapId={mapForEvent?.id}
        position={eventPosition}
        onEventAdded={handleEventAdded}
        projectId={project?.id}
        allMaps={maps}
        visibleMaps={getActiveMapSettings()}
        fullscreen={isMobile}
      />
      
      <ViewEventModal
        {...viewEventModalProps}
        fullscreen={isMobile}
      />
      
      <EditEventModal
        show={showEditEventModal}
        onHide={() => setShowEditEventModal(false)}
        event={selectedEvent}
        onEventUpdated={handleEventUpdated}
        projectId={project?.id}
        userRole={effectiveIsAdmin ? "ADMIN" : "MEMBER"}
        fullscreen={isMobile}
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