import React, { useRef, useEffect, useState } from 'react';
import { Spinner, Alert, Form, ListGroup } from 'react-bootstrap';
import EventMarker from './EventMarker';

const MapDetail = ({ map, events, onMapClick, isSelectingLocation, onEventClick, allMaps = [], projectId, onVisibleMapsChanged }) => {
  const mapContainerRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [visibleMaps, setVisibleMaps] = useState([]);
  
  // Find implantation map (main map) and overlay maps
  const implantationMap = allMaps.find(m => m.map_type === 'implantation') || map;
  const overlayMaps = allMaps.filter(m => m.id !== implantationMap?.id);
  
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
          setVisibleMaps(visibleMapIds);
        }
      }
    } catch (error) {
      console.error('Error loading saved map settings:', error);
    }
  }, [localStorageKey]);
  
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
  
  useEffect(() => {
    if (isSelectingLocation && mapContainerRef.current) {
      const container = mapContainerRef.current;
      
      const handleClick = (e) => {
        // Get click coordinates relative to the map container
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Calculate percentage coordinates
        const xPercent = (x / rect.width) * 100;
        const yPercent = (y / rect.height) * 100;
        
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
  }, [isSelectingLocation, map, onMapClick, visibleMaps]);
  
  const handleImageLoad = () => {
    setImageLoaded(true);
  };
  
  const handleImageError = () => {
    setLoadError(true);
    setImageLoaded(true); // Still set loaded to remove spinner
  };
  
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
      return (
        <div key={currentMap.id} style={layerStyle} className="pdf-container">
          <iframe 
            src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=Fit&zoom=page-fit`} 
            title={currentMap.name}
            style={{ 
              width: '100%', 
              height: '100%', 
              border: 'none',
              backgroundColor: 'transparent'
            }}
            frameBorder="0"
            onLoad={() => handleImageLoad()}
            onError={() => handleImageError()}
          />
        </div>
      );
    } else if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(fileExt)) {
      return (
        <div key={currentMap.id} style={layerStyle}>
          <img 
            src={url} 
            alt={currentMap.name} 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain'
            }}
            onLoad={() => handleImageLoad()}
            onError={() => handleImageError()}
          />
        </div>
      );
    } else {
      return (
        <div key={currentMap.id} style={layerStyle}>
          <iframe 
            src={url} 
            className="map-iframe-container"
            title={currentMap.name}
            style={{ width: '100%', height: '100%', border: 'none' }}
            onLoad={() => handleImageLoad()}
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
        
        <div className="map-layers-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
          {/* Always render main map first */}
          {renderMapLayer(implantationMap, 10)}
          
          {/* Then render overlay maps */}
          {overlayMapObjects.map((m, index) => renderMapLayer(m, 20 + index, true))}
        </div>
      </>
    );
  };
  
  // Filter events to show only ones visible on currently shown maps
  const visibleMapIds = implantationMap ? [implantationMap.id, ...visibleMaps.filter(id => id !== implantationMap.id)] : [];
  // Always include events from the main map, plus any events from visible overlay maps
  const visibleEvents = events.filter(event => {
    // Always show events from the main map
    if (event.map_id === implantationMap?.id) {
      return true;
    }
    // For other maps, only show events if the map is visible
    return visibleMaps.includes(event.map_id);
  });
  
  // Add a useEffect to notify parent component when visibleMaps changes
  useEffect(() => {
    // Only notify parent if callback is provided
    if (onVisibleMapsChanged) {
      onVisibleMapsChanged(visibleMaps);
    }
  }, [visibleMaps, onVisibleMapsChanged]);
  
  return (
    <div className="map-detail-container">
      <div 
        ref={mapContainerRef}
        className="map-container" 
        data-map-id={map?.id}
      >
        {renderMapContent()}
        
        {loadError && (
          <Alert variant="danger" className="map-error-overlay">
            Failed to load map content. Please check the file and try again.
          </Alert>
        )}
        
        {/* Render event markers - always positioned at highest z-index */}
        <div className="event-markers-container">
          {imageLoaded && visibleEvents && visibleEvents.length > 0 && visibleEvents.map(event => (
            <EventMarker 
              key={event.id} 
              event={event} 
              onClick={(e) => handleEventClick(event, e)}
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
        {visibleEvents && visibleEvents.length > 0 && (
          <div className="event-count-badge">
            {visibleEvents.length} {visibleEvents.length === 1 ? 'Event' : 'Events'}
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