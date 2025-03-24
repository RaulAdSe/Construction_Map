import React, { useRef, useEffect, useState } from 'react';
import { Spinner, Alert, Form, ListGroup } from 'react-bootstrap';
import EventMarker from './EventMarker';

const MapDetail = ({ map, events, onMapClick, isSelectingLocation, onEventClick, allMaps = [] }) => {
  const mapContainerRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [visibleMaps, setVisibleMaps] = useState([]);
  const [mapOpacity, setMapOpacity] = useState({});
  
  // Find implantation map (main map) and overlay maps
  const implantationMap = allMaps.find(m => m.map_type === 'implantation') || map;
  const overlayMaps = allMaps.filter(m => m.map_type === 'overlay' && m.id !== implantationMap.id);
  
  useEffect(() => {
    // Reset loading state when map changes
    if (map) {
      setImageLoaded(false);
      setLoadError(false);
    }
    
    // Initialize visible maps and opacity
    if (implantationMap) {
      // Always show the implantation map first
      setVisibleMaps(prev => {
        if (!prev.includes(implantationMap.id)) {
          return [...prev, implantationMap.id];
        }
        return prev;
      });
      
      setMapOpacity(prev => ({
        ...prev,
        [implantationMap.id]: 1.0
      }));
    }
  }, [map, implantationMap]);
  
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
        
        onMapClick(map, xPercent, yPercent);
      };
      
      container.style.cursor = 'crosshair';
      container.addEventListener('click', handleClick);
      
      return () => {
        container.style.cursor = 'default';
        container.removeEventListener('click', handleClick);
      };
    }
  }, [isSelectingLocation, map, onMapClick]);
  
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
      if (prevMaps.includes(mapId)) {
        return prevMaps.filter(id => id !== mapId);
      } else {
        return [...prevMaps, mapId];
      }
    });
  };
  
  const handleOpacityChange = (mapId, opacity) => {
    setMapOpacity(prev => ({
      ...prev,
      [mapId]: opacity
    }));
  };
  
  // Function to render a single map layer
  const renderMapLayer = (currentMap, zIndex) => {
    if (!currentMap || !currentMap.content_url) {
      return null;
    }
    
    const url = currentMap.content_url;
    const fileExt = url.split('.').pop().toLowerCase();
    const opacity = mapOpacity[currentMap.id] || 1.0;
    
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
    const visibleMapObjects = [
      implantationMap,
      ...overlayMaps.filter(m => visibleMaps.includes(m.id))
    ];
    
    return (
      <>
        {!imageLoaded && (
          <div className="map-loading-container">
            <Spinner animation="border" />
            <p>Loading map content...</p>
          </div>
        )}
        
        <div className="map-layers-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
          {visibleMapObjects.map((m, index) => renderMapLayer(m, 10 + index))}
        </div>
      </>
    );
  };
  
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
        
        {/* Render event markers */}
        {imageLoaded && events && events.length > 0 && events.map(event => (
          <EventMarker 
            key={event.id} 
            event={event} 
            onClick={(e) => handleEventClick(event, e)}
          />
        ))}
        
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
            {events.length} {events.length === 1 ? 'Event' : 'Events'}
          </div>
        )}
      </div>
      
      {/* Map overlay controls */}
      {overlayMaps.length > 0 && (
        <div className="map-overlay-controls mt-3">
          <h6>Map Layers</h6>
          <ListGroup>
            <ListGroup.Item className="d-flex justify-content-between align-items-center">
              <div>
                <Form.Check 
                  type="checkbox"
                  id={`map-toggle-${implantationMap.id}`}
                  label={`${implantationMap.name} (Main)`}
                  checked={visibleMaps.includes(implantationMap.id)}
                  onChange={() => toggleMapVisibility(implantationMap.id)}
                  className="me-2"
                  disabled={true} // Main map cannot be toggled off
                />
              </div>
              <Form.Range 
                value={mapOpacity[implantationMap.id] * 100 || 100}
                onChange={(e) => handleOpacityChange(implantationMap.id, parseInt(e.target.value) / 100)}
                min="20"
                max="100"
                className="w-50"
              />
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
                {visibleMaps.includes(overlayMap.id) && (
                  <Form.Range 
                    value={(mapOpacity[overlayMap.id] * 100) || 50}
                    onChange={(e) => handleOpacityChange(overlayMap.id, parseInt(e.target.value) / 100)}
                    min="10"
                    max="100"
                    className="w-50"
                  />
                )}
              </ListGroup.Item>
            ))}
          </ListGroup>
        </div>
      )}
    </div>
  );
};

export default MapDetail; 