import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Spinner, Alert, Form, ListGroup, Button } from 'react-bootstrap';
import EventMarker from './EventMarker';
import { useMobile } from './common/MobileProvider';

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
  const { isMobile } = useMobile();
  
  // For mobile: Add pinch-zoom capability
  const [isPinching, setIsPinching] = useState(false);
  const [mobilePanZoomScale, setMobilePanZoomScale] = useState(1);
  const lastTouchDistance = useRef(null);
  const lastTouchCenter = useRef(null);
  const initialTouchScale = useRef(null);
  const [showMobileControls, setShowMobileControls] = useState(false);
  
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
  }, [implantationMap?.id]); // Only rerun when the ID changes, not the whole object
  
  // Calculate viewport scaling and content positioning
  const updateViewportScaling = () => {
    if (!mapContainerRef.current || !mapContentRef.current) return;
    
    const container = mapContainerRef.current;
    
    // Get container dimensions
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // Use initial content dimensions if available, otherwise get from current content
    let contentWidth, contentHeight;
    if (initialContentSize.current) {
      contentWidth = initialContentSize.current.width;
      contentHeight = initialContentSize.current.height;
    } else {
      const contentRect = mapContentRef.current.getBoundingClientRect();
      contentWidth = contentRect.width || 1200;
      contentHeight = contentRect.height || 900;
    }
    
    // Calculate scale factors for width and height
    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    
    // Choose the smaller scale to ensure the content fits entirely
    // within the container while maintaining aspect ratio
    const newScale = Math.min(scaleX, scaleY) * 0.9425; // 0.9425 to leave slight margins
    
    setContainerSize({ width: containerWidth, height: containerHeight });
    setContentSize({ width: contentWidth, height: contentHeight });
    setViewportScale(newScale);
    
    // Only log when debugging
    if (DEBUG) {
      console.log(`Container: ${containerWidth}×${containerHeight}, Content: ${contentWidth}×${contentHeight}, Scale: ${newScale.toFixed(3)}`);
    }
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
    if (DEBUG) {
      console.log("Map image loaded, events should now be visible");
    }
    
    // Store initial content size if not already set
    if (!initialContentSize.current && mapContentRef.current) {
      const contentRect = mapContentRef.current.getBoundingClientRect();
      initialContentSize.current = {
        width: contentRect.width || 1200,
        height: (contentRect.height || 900) * 0.9425 // Apply height adjustment only once
      };
    }
    
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
  const visibleEvents = useMemo(() => {
    return events.filter(event => {
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
  }, [events, implantationMap, visibleMaps]);
  
  // Force imageLoaded to true after a timeout to ensure events display even if load events don't fire
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!imageLoaded) {
        console.log("Forcing imageLoaded=true after timeout");
        // Also log map data to help debug
        if (implantationMap) {
          console.log("Main map data:", {
            id: implantationMap.id,
            name: implantationMap.name,
            content_url: implantationMap.content_url,
            mapType: implantationMap.map_type
          });
        }
        
        // Temporarily set DEBUG to true to log overlay maps
        const tempDebug = true;
        if (tempDebug && overlayMaps.length > 0) {
          console.log("Overlay maps:", overlayMaps.map(m => ({
            id: m.id,
            name: m.name,
            content_url: m.content_url,
            visible: visibleMaps.includes(m.id)
          })));
        }
        
        setImageLoaded(true);
      }
    }, 2000); // 2 second timeout
    
    return () => clearTimeout(timer);
  }, [imageLoaded, implantationMap, overlayMaps, visibleMaps]);
  
  // Ensure event markers are always visible, regardless of map loading state
  useEffect(() => {
    // Log event visibility state only when debugging
    if (DEBUG && visibleEvents && visibleEvents.length > 0 && !imageLoaded) {
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
      console.log("No map or content_url for:", currentMap?.id, currentMap?.name);
      return null;
    }
    
    const url = currentMap.content_url;
    const fileExt = url.split('.').pop().toLowerCase();
    const opacity = mapOpacities[currentMap.id] || (isOverlay ? 0.5 : 1.0);
    
    console.log(`Rendering map: ${currentMap.name}, ID: ${currentMap.id}, URL: ${url}, Extension: ${fileExt}`);
    
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
      // For other file types, use a generic iframe
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
  
  // Add touch event handlers for mobile pinch-zoom
  useEffect(() => {
    if (!isMobile || !mapContainerRef.current) return;
    
    const container = mapContainerRef.current;
    
    const handleTouchStart = (e) => {
      if (e.touches.length === 2) {
        // Two finger touch - start pinch gesture
        setIsPinching(true);
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        lastTouchDistance.current = distance;
        
        // Calculate center point between touches
        lastTouchCenter.current = {
          x: (touch1.clientX + touch2.clientX) / 2,
          y: (touch1.clientY + touch2.clientY) / 2
        };
        
        initialTouchScale.current = mobilePanZoomScale;
      }
    };
    
    const handleTouchMove = (e) => {
      if (e.touches.length === 2 && isPinching) {
        e.preventDefault(); // Prevent default browser pinch zoom
        
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        
        if (lastTouchDistance.current && initialTouchScale.current) {
          // Calculate new scale based on touch distance change
          const delta = distance / lastTouchDistance.current;
          let newScale = initialTouchScale.current * delta;
          
          // Limit scale to reasonable range
          newScale = Math.max(0.5, Math.min(3, newScale));
          setMobilePanZoomScale(newScale);
        }
      }
    };
    
    const handleTouchEnd = () => {
      if (isPinching) {
        setIsPinching(false);
        lastTouchDistance.current = null;
        lastTouchCenter.current = null;
        initialTouchScale.current = null;
      }
    };
    
    // Add touch event listeners
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      // Clean up
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isMobile, isPinching, mobilePanZoomScale]);
  
  // Function to toggle mobile map layer controls
  const toggleMobileControls = () => {
    // If in selecting location mode, don't show controls
    if (isSelectingLocation) {
      return;
    }
    setShowMobileControls(!showMobileControls);
  };
  
  // When isSelectingLocation changes, hide mobile controls
  useEffect(() => {
    if (isSelectingLocation && showMobileControls) {
      setShowMobileControls(false);
    }
  }, [isSelectingLocation]);
  
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
      height: initialContentSize.current ? initialContentSize.current.height : contentSize.height,
      transform: isMobile 
        ? `scale(${viewportScale * mobilePanZoomScale})` 
        : `scale(${viewportScale})`,
      transformOrigin: 'center center',
      top: '50%',
      left: '50%',
      marginLeft: -(contentSize.width / 2),
      marginTop: -(initialContentSize.current ? initialContentSize.current.height / 2 : contentSize.height / 2)
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
                isMobile={isMobile} // Pass mobile state to event marker
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
    
    // Log only when debugging is enabled
    if (DEBUG) {
      console.log("Visible maps changed:", visibleMaps);
      console.log("Current visible events:", visibleEvents.length);
    }
  }, [visibleMaps, mapOpacities, onVisibleMapsChanged, implantationMap]); // Remove visibleEvents.length from dependencies
  
  // Console log on mount to debug events visibility
  useEffect(() => {
    if (DEBUG) {
      console.log("MapDetail mounted with events:", events.length);
      console.log("Visible maps:", visibleMaps);
      console.log("Visible events:", visibleEvents.length);
    }
  }, []); // Empty dependency array means this runs only on mount
  
  return (
    <div className={`map-detail-container ${isMobile ? 'mobile-map-detail' : ''}`}>
      <div 
        ref={mapContainerRef}
        className="map-container content-fit-view" 
        data-map-id={map?.id}
        data-scale={viewportScale.toFixed(3)}
        onClick={(e) => {
          if (isSelectingLocation && mapContentRef.current) {
            // Calculate click position relative to map content
            const rect = mapContentRef.current.getBoundingClientRect();
            const x = (e.clientX - rect.left) / (viewportScale * (isMobile ? mobilePanZoomScale : 1));
            const y = (e.clientY - rect.top) / (viewportScale * (isMobile ? mobilePanZoomScale : 1));
            
            if (DEBUG) {
              console.log(`Clicked at (${x.toFixed(2)}, ${y.toFixed(2)})`);
            }
            
            if (onMapClick) {
              onMapClick(map, x, y);
            }
          }
        }}
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
      </div>
      
      {/* Mobile controls button - moved outside map container to make it floating */}
      {isMobile && overlayMaps.length > 0 && (
        <Button
          variant="primary"
          className="mobile-layers-toggle"
          onClick={toggleMobileControls}
        >
          <i className="bi bi-layers"></i>
        </Button>
      )}
      
      {/* Mobile optimized map layers panel */}
      {isMobile ? (
        <div className={`mobile-overlay-controls ${showMobileControls ? 'show' : ''}`}>
          <div className="mobile-overlay-header">
            <h6>Map Layers</h6>
            <Button variant="link" className="close-btn" onClick={toggleMobileControls}>
              <i className="bi bi-x-lg"></i>
            </Button>
          </div>
          <div className="mobile-overlay-body">
            <ListGroup>
              <ListGroup.Item className="d-flex justify-content-between align-items-center main-map-item">
                <Form.Label htmlFor={`mobile-map-opacity-${implantationMap?.id}`} className="mb-0">
                  {implantationMap?.name} (Main)
                </Form.Label>
                <Form.Range 
                  id={`mobile-map-opacity-${implantationMap?.id}`}
                  value={(mapOpacities[implantationMap?.id] || 1.0) * 100}
                  onChange={(e) => handleOpacityChange(implantationMap?.id, parseInt(e.target.value))}
                  min="50"
                  max="100"
                  style={{ width: '120px' }}
                />
              </ListGroup.Item>
              
              {overlayMaps.map(overlayMap => (
                <ListGroup.Item 
                  key={overlayMap.id}
                  className="d-flex justify-content-between align-items-center"
                  style={{ opacity: visibleMaps.includes(overlayMap.id) ? 1 : 0.5 }}
                >
                  <Form.Check 
                    type="checkbox"
                    id={`mobile-map-toggle-${overlayMap.id}`}
                    label={overlayMap.name}
                    checked={visibleMaps.includes(overlayMap.id)}
                    onChange={() => toggleMapVisibility(overlayMap.id)}
                    className="mb-0"
                  />
                  {visibleMaps.includes(overlayMap.id) && (
                    <Form.Range 
                      value={(mapOpacities[overlayMap.id] || 0.5) * 100}
                      onChange={(e) => handleOpacityChange(overlayMap.id, parseInt(e.target.value))}
                      min="20"
                      max="100"
                      style={{ width: '100px' }}
                    />
                  )}
                </ListGroup.Item>
              ))}
            </ListGroup>
          </div>
        </div>
      ) : (
        /* Original desktop controls */
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
                <ListGroup.Item key={overlayMap.id} className="d-flex justify-content-between align-items-center">
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
                  <div style={{ width: '50%' }}>
                    <Form.Range 
                      value={(mapOpacities[overlayMap.id] || 0.5) * 100}
                      onChange={(e) => handleOpacityChange(overlayMap.id, parseInt(e.target.value))}
                      min="20"
                      max="100"
                      disabled={!visibleMaps.includes(overlayMap.id)}
                    />
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </div>
      )}
    </div>
  );
};

export default MapDetail; 