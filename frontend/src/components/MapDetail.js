import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Spinner, Alert, Form, ListGroup } from 'react-bootstrap';
import EventMarker from './EventMarker';
import translate from '../utils/translate';

const DEBUG = false; // Set to true only when debugging is needed

const MapDetail = ({ map, events, onMapClick, isSelectingLocation, onEventClick, allMaps = [], projectId, onVisibleMapsChanged }) => {
  const mapContainerRef = useRef(null);
  const mapContentRef = useRef(null);
  const initialContentSize = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 });
  const [viewportScale, setViewportScale] = useState(1);
  
  // Map opacities for overlay maps
  const [mapOpacities, setMapOpacities] = useState(() => {
    // Initialize with default opacity of 0.5
    const opacities = {};
    allMaps.forEach(m => {
      if (m.map_type === 'overlay') {
        opacities[m.id] = 0.5;
      }
    });
    return opacities;
  });
  
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
      if (DEBUG) {
        console.log("Ensuring main map is in visible maps:", implantationMap.id);
      }
      
      // Only update if the implantation map isn't already included
      setVisibleMaps(prev => {
        if (!prev.includes(implantationMap.id)) {
          return [implantationMap.id, ...prev.filter(id => id !== implantationMap.id)];
        }
        return prev;
      });
    }
  }, [implantationMap?.id]);
  
  // Notify parent component about visible maps changes
  useEffect(() => {
    if (onVisibleMapsChanged) {
      onVisibleMapsChanged(visibleMaps);
    }
    
    // Save visible maps to localStorage
    try {
      localStorage.setItem(`map_overlays_${projectId}`, JSON.stringify(visibleMaps));
    } catch (error) {
      console.error('Error saving map visibility settings:', error);
    }
  }, [visibleMaps, projectId, onVisibleMapsChanged]);
  
  // Toggle map visibility
  const toggleMapVisibility = (mapId) => {
    setVisibleMaps(prevVisible => {
      if (prevVisible.includes(mapId)) {
        return prevVisible.filter(id => id !== mapId);
      } else {
        return [...prevVisible, mapId];
      }
    });
  };
  
  // Handle opacity change for overlay maps
  const handleOpacityChange = (mapId, opacityPercent) => {
    setMapOpacities(prev => ({
      ...prev,
      [mapId]: opacityPercent / 100
    }));
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
      if (DEBUG) {
        console.log("MapDetail detected main map change to:", mainMap.name);
      }
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
  
  // Calculate and set the viewport scaling factor
  const updateViewportScaling = () => {
    if (mapContainerRef.current && mapContentRef.current) {
      const containerRect = mapContainerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;
      
      // Get natural dimensions of the image (before any scaling)
      const contentWidth = mapContentRef.current.naturalWidth;
      const contentHeight = mapContentRef.current.naturalHeight;
      
      // Store the content size for future reference
      if (!initialContentSize.current && contentWidth && contentHeight) {
        initialContentSize.current = { width: contentWidth, height: contentHeight };
      }
      
      // Update state with current sizes
      setContainerSize({ width: containerWidth, height: containerHeight });
      setContentSize({ width: contentWidth, height: contentHeight });
      
      // Calculate the scale factor to fit the image in the container
      if (contentWidth && contentHeight) {
        const widthRatio = containerWidth / contentWidth;
        const heightRatio = containerHeight / contentHeight;
        
        // Use the smaller ratio to ensure the image fits within the container
        const scale = Math.min(widthRatio, heightRatio, 1); // Cap at 1 to prevent enlarging
        
        setViewportScale(scale);
      }
    }
  };
  
  // Handle image loading
  const handleImageLoad = () => {
    setImageLoaded(true);
    setLoadError(false);
    updateViewportScaling(); // Recalculate scaling once image is loaded
  };
  
  // Handle image loading error
  const handleImageError = () => {
    setImageLoaded(false);
    setLoadError(true);
    console.error(`Failed to load map image for map ID: ${implantationMap?.id}`);
  };
  
  // Convert event coordinates to viewport coordinates
  const getEventPosition = (event) => {
    if (!event || !event.position_x || !event.position_y) return null;
    
    // If we don't have the content size yet, we can't calculate the position
    if (!contentSize.width || !contentSize.height) return null;
    
    // Calculate position based on the percentage of the original image
    const xPos = (event.position_x / 100) * contentSize.width * viewportScale;
    const yPos = (event.position_y / 100) * contentSize.height * viewportScale;
    
    return { x: xPos, y: yPos };
  };
  
  // Handle map click for adding events
  const handleMapClick = (e) => {
    if (!isSelectingLocation || !onMapClick) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Convert click position to percentage of the image
    const xPercent = (clickX / (contentSize.width * viewportScale)) * 100;
    const yPercent = (clickY / (contentSize.height * viewportScale)) * 100;
    
    // Clamp values to ensure they're between 0-100
    const clampedX = Math.max(0, Math.min(100, xPercent));
    const clampedY = Math.max(0, Math.min(100, yPercent));
    
    onMapClick({ x: clampedX, y: clampedY });
  };
  
  // Filter events to only those associated with the currently visible maps
  const visibleEvents = useMemo(() => {
    const filteredEvents = events?.filter(event => visibleMaps.includes(event.map_id)) || [];
    if (DEBUG) {
      console.log(`Filtered ${filteredEvents.length} events for visible maps`, visibleMaps);
    }
    return filteredEvents;
  }, [events, visibleMaps]);
  
  // If there's no map at all, show a message
  if (!implantationMap) {
    return (
      <div className="map-empty-state">
        <Alert variant="info">
          {translate('No map selected. Please select a map from the Project Maps tab or add a new one.')}
        </Alert>
      </div>
    );
  }
  
  // Show loader while the map is loading
  if (!imageLoaded && !loadError) {
    return (
      <div className="map-loading">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">{translate('Loading...')}</span>
        </Spinner>
      </div>
    );
  }
  
  // Show error if image failed to load
  if (loadError) {
    return (
      <div className="map-error">
        <Alert variant="danger">
          {translate('Failed to load map image. Please try refreshing the page.')}
        </Alert>
      </div>
    );
  }
  
  return (
    <div className="map-detail-container">
      <div className="map-viewport" ref={mapContainerRef} onClick={handleMapClick}>
        <div className="map-content" style={{ transform: `scale(${viewportScale})` }}>
          {/* Main map */}
          <img
            ref={mapContentRef}
            src={implantationMap?.image_url}
            alt={implantationMap?.name}
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{ position: 'absolute', top: 0, left: 0 }}
          />
          
          {/* Overlay maps */}
          {overlayMaps.map(overlayMap => (
            visibleMaps.includes(overlayMap.id) && (
              <img
                key={overlayMap.id}
                src={overlayMap?.image_url}
                alt={overlayMap?.name}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  opacity: mapOpacities[overlayMap.id] || 0.5,
                  pointerEvents: 'none' // Allow clicks to pass through to the base map
                }}
              />
            )
          ))}
          
          {/* Event markers */}
          {visibleEvents.map(event => {
            const position = getEventPosition(event);
            if (!position) return null;
            
            return (
              <EventMarker
                key={event.id}
                event={event}
                position={position}
                onClick={() => onEventClick && onEventClick(event)}
              />
            );
          })}
          
          {/* Location selection indicator if in selection mode */}
          {isSelectingLocation && (
            <div className="selection-indicator">
              {translate('Click on the map to place your event.')}
            </div>
          )}
        </div>
      </div>
      
      {/* Layer controls */}
      <div className="map-layers">
        <h6>{translate('Visible Layers')}</h6>
        {overlayMaps.length > 0 ? (
          <ListGroup>
            {implantationMap && (
              <ListGroup.Item className="d-flex justify-content-between align-items-center">
                <Form.Check
                  type="checkbox"
                  id={`map-toggle-main`}
                  label={`${implantationMap.name} (${translate('Primary')})`}
                  checked={visibleMaps.includes(implantationMap.id)}
                  onChange={() => toggleMapVisibility(implantationMap.id)}
                  disabled={true} // Main map should always be visible
                  className="me-2"
                />
              </ListGroup.Item>
            )}
            
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
        ) : (
          <Alert variant="info">
            {translate('No overlay maps available.')}
          </Alert>
        )}
        {!implantationMap && (
          <Alert variant="info">
            {translate('No maps available for this project. Please add a map to get started.')}
          </Alert>
        )}
      </div>
    </div>
  );
};

export default MapDetail; 