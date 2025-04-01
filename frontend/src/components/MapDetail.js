import React, { useRef, useEffect, useState } from 'react';
import { Spinner, Alert, Form, ListGroup } from 'react-bootstrap';
import EventMarker from './EventMarker';

const MapDetail = ({ map, events, onMapClick, isSelectingLocation, onEventClick, allMaps = [], projectId, onVisibleMapsChanged }) => {
  const mapContainerRef = useRef(null);
  const mapContentRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 });
  const [viewportScale, setViewportScale] = useState(1);
  
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
  
  // Calculate viewport scaling and content positioning
  const updateViewportScaling = () => {
    if (!mapContainerRef.current || !mapContentRef.current) return;
    
    const container = mapContainerRef.current;
    const content = mapContentRef.current;
    
    // Get container dimensions
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // Get content dimensions
    const contentRect = content.getBoundingClientRect();
    let contentWidth = contentRect.width;
    let contentHeight = contentRect.height;
    
    // If content dimensions are zero (not yet rendered), use defaults
    if (contentWidth <= 0) contentWidth = 1200;
    if (contentHeight <= 0) contentHeight = 900;
    
    // Calculate scale factors for width and height
    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    
    // Choose the smaller scale to ensure the content fits entirely
    // within the container while maintaining aspect ratio
    const newScale = Math.min(scaleX, scaleY) * 0.95; // 0.95 to leave slight margins
    
    setContainerSize({ width: containerWidth, height: containerHeight });
    setContentSize({ width: contentWidth, height: contentHeight });
    setViewportScale(newScale);
    
    console.log(`Container: ${containerWidth}×${containerHeight}, Content: ${contentWidth}×${contentHeight}, Scale: ${newScale.toFixed(3)}`);
  };
  
  // Initialize and update viewport scaling on mount and resize
  useEffect(() => {
    if (!mapContainerRef.current) return;
    
    // Initial calculation
    updateViewportScaling();
    
    // Set up resize observer
    const resizeObserver = new ResizeObserver(() => {
      updateViewportScaling();
    });
    
    resizeObserver.observe(mapContainerRef.current);
    
    // Clean up
    return () => {
      if (mapContainerRef.current) {
        resizeObserver.unobserve(mapContainerRef.current);
      }
    };
  }, [imageLoaded]); // Recalculate when image loads
  
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
        // Get the content element's bounding rect
        const contentRect = mapContentRef.current.getBoundingClientRect();
        
        // Get click coordinates relative to the container
        const containerRect = container.getBoundingClientRect();
        const containerX = e.clientX - containerRect.left;
        const containerY = e.clientY - containerRect.top;
        
        // Convert container coordinates to content coordinates
        const contentX = (containerX - (containerRect.width - contentRect.width * viewportScale) / 2) / viewportScale;
        const contentY = (containerY - (containerRect.height - contentRect.height * viewportScale) / 2) / viewportScale;
        
        // Calculate percentage coordinates relative to the content
        const xPercent = (contentX / contentRect.width) * 100;
        const yPercent = (contentY / contentRect.height) * 100;
        
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
  }, [isSelectingLocation, map, onMapClick, visibleMaps, viewportScale]);
  
  const handleImageLoad = (e) => {
    setImageLoaded(true);
    console.log("Map image loaded, events should now be visible");
    
    // Trigger viewport scaling calculation after image is loaded
    setTimeout(updateViewportScaling, 100);
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
  
  // Store map opacity settings
  const [mapOpacities, setMapOpacities] = useState(() => {
    // Default opacities: 100% for main map, 50% for overlays
    const defaultOpacities = {};
    if (implantationMap) {
      defaultOpacities[implantationMap.id] = 1.0;
    }
    overlayMaps.forEach(map => {
      defaultOpacities[map.id] = 0.5;
    });
    return defaultOpacities;
  });
  
  // Handle opacity change for a map
  const handleOpacityChange = (mapId, opacity) => {
    setMapOpacities(prev => ({
      ...prev,
      [mapId]: opacity / 100
    }));
  };
  
  // Function to render a single map layer
  const renderMapLayer = (currentMap, zIndex, isOverlay = false) => {
    if (!currentMap || !currentMap.content_url) {
      return null;
    }
    
    const url = currentMap.content_url;
    const fileExt = url.split('.').pop().toLowerCase();
    const opacity = mapOpacities[currentMap.id] || (isOverlay ? 0.5 : 1.0);
    
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
    
    // Calculate the content container style with centered positioning
    const contentStyle = {
      position: 'absolute',
      width: contentSize.width,
      height: contentSize.height,
      transform: `scale(${viewportScale})`,
      transformOrigin: 'center center',
      top: '50%',
      left: '50%',
      marginLeft: -(contentSize.width / 2),
      marginTop: -(contentSize.height / 2)
    };
    
    return (
      <>
        {!imageLoaded && (
          <div className="map-loading-container">
            <Spinner animation="border" />
            <p>Loading map content...</p>
          </div>
        )}
        
        <div 
          ref={mapContentRef}
          className="map-content-container" 
          style={contentStyle}
        >
          {/* Always render main map first */}
          {renderMapLayer(implantationMap, 10)}
          
          {/* Then render overlay maps */}
          {overlayMapObjects.map((m, index) => renderMapLayer(m, 20 + index, true))}
          
          {/* Render event markers within the content container */}
          <div className="event-markers-container">
            {visibleEvents && visibleEvents.length > 0 && visibleEvents.map(event => (
              <EventMarker 
                key={event.id} 
                event={event} 
                onClick={(e) => handleEventClick(event, e)}
                scale={1} // No need to adjust scale as we're in the content coordinate system
              />
            ))}
          </div>
        </div>
      </>
    );
  };
  
  // Add a useEffect to notify parent component when visibleMaps changes
  useEffect(() => {
    // Only notify parent if callback is provided
    if (onVisibleMapsChanged) {
      // Create an object with map IDs and their opacity settings
      const mapSettings = {};
      visibleMaps.forEach(id => {
        mapSettings[id] = {
          opacity: mapOpacities[id] || (id === implantationMap?.id ? 1.0 : 0.5)
        };
      });
      
      onVisibleMapsChanged(visibleMaps, mapSettings);
    }
    
    // Log whenever visible maps change to help debug
    console.log("Visible maps changed:", visibleMaps);
    console.log("Current visible events:", visibleEvents.length);
  }, [visibleMaps, mapOpacities, onVisibleMapsChanged, visibleEvents.length, implantationMap]);
  
  // Console log on mount to debug events visibility
  useEffect(() => {
    console.log("MapDetail mounted with events:", events.length);
    console.log("Visible maps:", visibleMaps);
    console.log("Visible events:", visibleEvents.length);
  }, []); // Empty dependency array means this runs only on mount
  
  return (
    <div className="map-detail-container">
      <div 
        ref={mapContainerRef}
        className="map-container content-fit-view" 
        data-map-id={map?.id}
        data-scale={viewportScale.toFixed(3)}
      >
        {renderMapContent()}
        
        {loadError && (
          <Alert variant="danger" className="map-error-overlay">
            Failed to load map content. Please check the file and try again.
          </Alert>
        )}
        
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
              {/* Add opacity slider for main map */}
              <div style={{ width: '50%' }}>
                <Form.Range 
                  value={(mapOpacities[implantationMap.id] || 1.0) * 100}
                  onChange={(e) => handleOpacityChange(implantationMap.id, parseInt(e.target.value))}
                  min="50"
                  max="100"
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
                {/* Add opacity slider for overlay maps */}
                {visibleMaps.includes(overlayMap.id) && (
                  <div style={{ width: '50%' }}>
                    <Form.Range 
                      value={(mapOpacities[overlayMap.id] || 0.5) * 100}
                      onChange={(e) => handleOpacityChange(overlayMap.id, parseInt(e.target.value))}
                      min="10"
                      max="100"
                    />
                  </div>
                )}
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