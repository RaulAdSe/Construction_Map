import React, { useRef, useEffect, useState } from 'react';
import { Spinner, Alert, Form, ListGroup } from 'react-bootstrap';
import EventMarker from './EventMarker';

const MapDetail = ({ map, events, onMapClick, isSelectingLocation, onEventClick, allMaps = [], projectId, onVisibleMapsChanged }) => {
  const mapContainerRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [mapScale, setMapScale] = useState(1);
  const [originalMapSize, setOriginalMapSize] = useState({ width: 0, height: 0 });
  
  // Find implantation map (main map) and overlay maps
  const implantationMap = allMaps.find(m => m.map_type === 'implantation') || map;
  const overlayMaps = allMaps.filter(m => m.id !== implantationMap?.id);
  
  // Initialize visibleMaps with the main map ID already included if available
  const [visibleMaps, setVisibleMaps] = useState(() => {
    return implantationMap ? [implantationMap.id] : [];
  });
  
  // Ensure main map ID is always in visibleMaps - with high priority
  useEffect(() => {
    if (implantationMap && implantationMap.id) {
      console.log("Ensuring main map is in visible maps:", implantationMap.id);
      setVisibleMaps(prev => {
        if (!prev.includes(implantationMap.id)) {
          return [implantationMap.id, ...prev.filter(id => id !== implantationMap.id)];
        }
        return prev;
      });
    }
  }, [implantationMap]);
  
  // Track original map dimensions to maintain aspect ratio
  const updateOriginalMapSize = (width, height) => {
    if (width > 0 && height > 0 && (originalMapSize.width === 0 || originalMapSize.height === 0)) {
      setOriginalMapSize({ width, height });
      console.log(`Original map dimensions set: ${width}x${height}`);
    }
  };
  
  // Add a ResizeObserver to keep track of container size changes
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    const updateContainerSize = () => {
      const container = mapContainerRef.current;
      if (container) {
        const { width, height } = container.getBoundingClientRect();
        setContainerSize({ width, height });
        
        // Use a reference size based on a standard document size (e.g., A1 dimensions in pixels)
        // This ensures consistent scaling across all devices
        const referenceWidth = 1200; // Standard reference width in pixels
        const currentScale = Math.min(width / referenceWidth, 1); // Cap scale at 1.0 to prevent overly large maps
        
        setMapScale(currentScale);
        console.log("Map container resized. New scale:", currentScale.toFixed(3));
      }
    };
    
    // Initial size calculation
    updateContainerSize();
    
    // Set up resize observer
    const resizeObserver = new ResizeObserver(entries => {
      updateContainerSize();
    });
    resizeObserver.observe(mapContainerRef.current);
    
    // Clean up
    return () => {
      if (mapContainerRef.current) {
        resizeObserver.unobserve(mapContainerRef.current);
      }
    };
  }, []);
  
  // Track dependency on map types to refresh when they change
  useEffect(() => {
    // Recalculate implantation map and overlay maps when allMaps changes
    const mainMap = allMaps.find(m => m.map_type === 'implantation');
    if (mainMap) {
      console.log("MapDetail detected main map change to:", mainMap.name);
    }
  }, [allMaps]);
  
  // Store map visibility settings in localStorage
  const localStorageKey = `map_overlays_${projectId}`;
  
  // Load saved settings on component mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(localStorageKey);
      if (savedSettings) {
        const visibleMapIds = JSON.parse(savedSettings);
        if (visibleMapIds && Array.isArray(visibleMapIds)) {
          // Always ensure the main map is included in the loaded settings
          if (implantationMap && !visibleMapIds.includes(implantationMap.id)) {
            setVisibleMaps([implantationMap.id, ...visibleMapIds]);
          } else {
            setVisibleMaps(visibleMapIds);
          }
        }
      }
    } catch (error) {
      console.error('Error loading saved map settings:', error);
    }
  }, [localStorageKey, implantationMap]);
  
  // Initialize default settings for main map when it changes
  useEffect(() => {
    // Reset loading state when map changes
    if (map) {
      setImageLoaded(false);
      setLoadError(false);
    }
    
    // Always ensure main map is visible
    if (implantationMap) {
      setVisibleMaps(prev => {
        if (!prev.includes(implantationMap.id)) {
          return [...prev, implantationMap.id];
        }
        return prev;
      });
    }
  }, [map, implantationMap]);
  
  // Save settings to localStorage when they change
  useEffect(() => {
    if (implantationMap && visibleMaps.length > 0) {
      try {
        localStorage.setItem(localStorageKey, JSON.stringify(visibleMaps));
      } catch (error) {
        console.error('Error saving map settings:', error);
      }
    }
  }, [visibleMaps, implantationMap, localStorageKey]);
  
  // Handle click events for adding new events
  useEffect(() => {
    if (isSelectingLocation && mapContainerRef.current) {
      const container = mapContainerRef.current;
      
      const handleClick = (e) => {
        // Get click coordinates relative to the map container
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Calculate percentage coordinates
        // Adjust for the current scale to ensure accurate positioning
        const xPercent = ((x / mapScale) / rect.width) * 100;
        const yPercent = ((y / mapScale) / rect.height) * 100;
        
        // Create modified map object with the current visibleMaps
        const mapWithVisibleLayers = {
          ...map,
          visibleMaps: visibleMaps
        };
        
        onMapClick(mapWithVisibleLayers, xPercent, yPercent);
      };
      
      container.style.cursor = 'crosshair';
      container.addEventListener('click', handleClick);
      
      return () => {
        container.style.cursor = 'default';
        container.removeEventListener('click', handleClick);
      };
    }
  }, [isSelectingLocation, map, onMapClick, visibleMaps, mapScale]);
  
  const handleImageLoad = (e) => {
    // Store the natural dimensions of the image when it loads
    if (e && e.target) {
      const { naturalWidth, naturalHeight } = e.target;
      updateOriginalMapSize(naturalWidth, naturalHeight);
    }
    
    setImageLoaded(true);
    console.log("Map image loaded, events should now be visible");
  };
  
  const handleImageError = () => {
    setLoadError(true);
    setImageLoaded(true); // Still set loaded to remove spinner
  };
  
  // Filter events to show only ones visible on currently shown maps
  const visibleMapIds = implantationMap ? [implantationMap.id, ...visibleMaps.filter(id => id !== implantationMap.id)] : [];
  
  // ALWAYS include events from the main map, plus any events from visible overlay maps
  // BUT exclude events with 'closed' status
  const visibleEvents = events.filter(event => {
    if (!event || !event.map_id) return false;
    
    // Skip closed events regardless of map
    if (event.status === 'closed') return false;
    
    // Always show events from the main map, regardless of visibility state
    if (event.map_id === implantationMap?.id) {
      return true;
    }
    
    // For overlay maps, only show events if that map is toggled on
    return visibleMaps.includes(event.map_id);
  });
  
  // Force imageLoaded to true after a timeout to ensure events display even if load events don't fire
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!imageLoaded) {
        console.log("Forcing imageLoaded=true after timeout");
        setImageLoaded(true);
      }
    }, 2000); // 2 second timeout
    
    return () => clearTimeout(timer);
  }, [imageLoaded]);
  
  // Ensure event markers are always visible, regardless of map loading state
  useEffect(() => {
    // Log event visibility state
    if (visibleEvents && visibleEvents.length > 0 && !imageLoaded) {
      console.log("Events ready but map not loaded yet");
    }
  }, [visibleEvents, imageLoaded]);
  
  const handleEventClick = (event, e) => {
    // Stop propagation to prevent map click handler from firing
    e.stopPropagation();
    if (onEventClick) {
      onEventClick(event);
    }
  };
  
  const toggleMapVisibility = (mapId) => {
    setVisibleMaps(prevMaps => {
      // Don't allow toggling off the main map
      if (mapId === implantationMap?.id) {
        return prevMaps;
      }
      
      if (prevMaps.includes(mapId)) {
        return prevMaps.filter(id => id !== mapId);
      } else {
        return [...prevMaps, mapId];
      }
    });
  };
  
  // Function to render a single map layer
  const renderMapLayer = (currentMap, zIndex, isOverlay = false) => {
    if (!currentMap || !currentMap.content_url) {
      return null;
    }
    
    const url = currentMap.content_url;
    const fileExt = url.split('.').pop().toLowerCase();
    const opacity = isOverlay ? 0.5 : 1.0; // Fixed opacity: 100% for main map, 50% for overlays
    
    const layerStyle = {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      opacity: opacity,
      zIndex: zIndex,
      pointerEvents: 'none', // Let clicks pass through to the base container
    };
    
    if (fileExt === 'pdf') {
      // For PDFs, use an iframe with direct embed and hide UI controls
      // Use a consistent scaling approach for PDFs
      return (
        <div key={currentMap.id} style={layerStyle} className="pdf-container">
          <iframe 
            src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} 
            title={currentMap.name}
            style={{ 
              width: '100%', 
              height: '100%', 
              border: 'none',
              backgroundColor: 'transparent'
            }}
            frameBorder="0"
            onLoad={(e) => handleImageLoad(e)}
            onError={() => handleImageError()}
            className="consistent-pdf-view"
          />
        </div>
      );
    } else if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(fileExt)) {
      // For images, contain them in their container with consistent scaling
      return (
        <div key={currentMap.id} style={layerStyle} className="map-image-container">
          <img 
            src={url} 
            alt={currentMap.name} 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain'
            }}
            onLoad={(e) => handleImageLoad(e)}
            onError={() => handleImageError()}
            className="consistent-map-image"
          />
        </div>
      );
    } else {
      return (
        <div key={currentMap.id} style={layerStyle}>
          <iframe 
            src={url} 
            className="map-iframe-container consistent-iframe-view"
            title={currentMap.name}
            style={{ width: '100%', height: '100%', border: 'none' }}
            onLoad={(e) => handleImageLoad(e)}
            onError={() => handleImageError()}
          />
        </div>
      );
    }
  };
  
  // Function to render map content with layers
  const renderMapContent = () => {
    if (!implantationMap || !implantationMap.content_url) {
      return <div className="no-content">No content available</div>;
    }
    
    // Get all maps that should be visible
    const overlayMapObjects = overlayMaps.filter(m => visibleMaps.includes(m.id));
    
    return (
      <>
        {!imageLoaded && (
          <div className="map-loading-container">
            <Spinner animation="border" />
            <p>Loading map content...</p>
          </div>
        )}
        
        <div 
          className="map-layers-container" 
          style={{ 
            position: 'relative', 
            width: '100%', 
            height: '100%',
            transform: `scale(${mapScale})`,
            transformOrigin: 'top left'
          }}
        >
          {/* Always render main map first */}
          {renderMapLayer(implantationMap, 10)}
          
          {/* Then render overlay maps */}
          {overlayMapObjects.map((m, index) => renderMapLayer(m, 20 + index, true))}
        </div>
      </>
    );
  };
  
  // Add a useEffect to notify parent component when visibleMaps changes
  useEffect(() => {
    // Only notify parent if callback is provided
    if (onVisibleMapsChanged) {
      onVisibleMapsChanged(visibleMaps);
    }
    
    // Log whenever visible maps change to help debug
    console.log("Visible maps changed:", visibleMaps);
    console.log("Current visible events:", visibleEvents.length);
  }, [visibleMaps, onVisibleMapsChanged, visibleEvents.length]);
  
  // Console log on mount to debug events visibility
  useEffect(() => {
    console.log("MapDetail mounted with events:", events.length);
    console.log("Visible maps:", visibleMaps);
    console.log("Visible events:", visibleEvents.length);
  }, []); // Empty dependency array means this runs only on mount
  
  // Modify event markers container to ensure exact positioning
  const eventMarkersStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 2000, // Ensure it's above all map layers
    pointerEvents: 'none', // Let clicks pass through to the map
    // Apply the same scale transform to events to keep them aligned with the maps
    transform: `scale(${mapScale})`,
    transformOrigin: 'top left'
  };
  
  return (
    <div className="map-detail-container">
      <div 
        ref={mapContainerRef}
        className="map-container consistent-map-view" 
        data-map-id={map?.id}
        data-scale={mapScale.toFixed(3)}
      >
        {renderMapContent()}
        
        {loadError && (
          <Alert variant="danger" className="map-error-overlay">
            Failed to load map content. Please check the file and try again.
          </Alert>
        )}
        
        {/* Render event markers - always positioned at highest z-index */}
        <div className="event-markers-container" style={eventMarkersStyle}>
          {visibleEvents && visibleEvents.length > 0 && visibleEvents.map(event => (
            <EventMarker 
              key={event.id} 
              event={event} 
              onClick={(e) => handleEventClick(event, e)}
              scale={mapScale}
            />
          ))}
        </div>
        
        {isSelectingLocation && (
          <div className="selecting-location-overlay">
            <div className="selecting-location-message">
              Click on the map to place your event
            </div>
          </div>
        )}
        
        {/* Display event count badge */}
        {events && events.length > 0 && (
          <div className="event-count-badge">
            {visibleEvents.length} of {events.length} {events.length === 1 ? 'Event' : 'Events'}
          </div>
        )}
      </div>
      
      {/* Map overlay controls */}
      <div className="map-overlay-controls mt-3">
        <h6>Map Layers</h6>
        {implantationMap && (
          <ListGroup>
            <ListGroup.Item className="d-flex justify-content-between align-items-center main-map-item">
              <div>
                <Form.Check 
                  type="checkbox"
                  id={`map-toggle-${implantationMap.id}`}
                  label={`${implantationMap.name} (Main)`}
                  checked={true}
                  className="me-2"
                  disabled={true} // Main map cannot be toggled off
                />
              </div>
            </ListGroup.Item>
            
            {overlayMaps.map(overlayMap => (
              <ListGroup.Item 
                key={overlayMap.id}
                className="d-flex justify-content-between align-items-center"
              >
                <div>
                  <Form.Check 
                    type="checkbox"
                    id={`map-toggle-${overlayMap.id}`}
                    label={overlayMap.name}
                    checked={visibleMaps.includes(overlayMap.id)}
                    onChange={() => toggleMapVisibility(overlayMap.id)}
                    className="me-2"
                  />
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
        {!implantationMap && (
          <Alert variant="info">
            No maps available for this project. Add a map to get started.
          </Alert>
        )}
      </div>
    </div>
  );
};

export default MapDetail; 