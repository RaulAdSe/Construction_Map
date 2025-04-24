import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Spinner, Alert, Form, ListGroup, Button } from 'react-bootstrap';
import EventMarker from './EventMarker';
import { useMobile } from './common/MobileProvider';
import translate from '../utils/translate';

const DEBUG = false; // Set to true only when debugging is needed

const MapDetail = ({
  map,
  events,
  eventKey,
  onMapClick,
  isSelectingLocation = false,
  onEventClick,
  allMaps = [],
  projectId,
  onVisibleMapsChanged = () => {}
}) => {
  const mapContainerRef = useRef(null);
  const mapContentRef = useRef(null);
  const initialContentSize = useRef(null);
  const lastEventKeyRef = useRef(null); // Add a ref to track last event key
  const visibleEventsKeyRef = useRef(null); // Add a ref to track visible events calculation
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
  const updateViewportScaling = useCallback(() => {
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
      // Add a safety check to confirm mapContentRef.current is still valid
      if (!mapContentRef.current) {
        console.warn('Map content reference became null during viewport scaling calculation');
        return;
      }
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
  }, []);
  
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
  }, [imageLoaded, updateViewportScaling]);
  
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
        // Ensure mapContentRef is not null before accessing it
        if (!mapContentRef.current) {
          console.warn('Map content reference is null, cannot calculate coordinates');
          return;
        }
        
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
    // Store initial size of loaded content for reference
    if (mapContentRef.current) {
      const contentRect = mapContentRef.current.getBoundingClientRect();
      initialContentSize.current = {
        width: contentRect.width || 1200,
        height: (contentRect.height || 900) * 0.9425 // Apply height adjustment only once
      };
      
      if (DEBUG) {
        console.log(`Image loaded with dimensions: ${contentRect.width}×${contentRect.height}`);
      }
    } else {
      console.warn('Map content reference is null, cannot calculate loaded image dimensions');
      initialContentSize.current = { width: 1200, height: 900 }; // Set default size
    }
    
    setImageLoaded(true);
    if (DEBUG) {
      console.log("Map image loaded, events should now be visible");
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
  
  // Calculate which events should be visible on the map - optimized
  const visibleEvents = useMemo(() => {
    if (!events || !Array.isArray(events) || events.length === 0) {
      console.log('MapDetail received no events to display');
      return [];
    }
    
    // Only log when eventKey actually changes
    if (eventKey !== visibleEventsKeyRef.current) {
      console.log(`MapDetail: Recalculating visible events with key: ${eventKey}, events count: ${events.length}`);
      
      // Log the first few events for debugging
      if (events.length > 0) {
        const sample = events.slice(0, Math.min(3, events.length));
        console.log('MapDetail sample events:', sample.map(e => ({
          id: e.id,
          state: e.state,
          title: e.title,
          x_coordinate: e.x_coordinate,
          y_coordinate: e.y_coordinate,
          location_x: e.location_x,
          location_y: e.location_y
        })));
      }
      
      visibleEventsKeyRef.current = eventKey;
    }
    
    // Return the events as is - they're already filtered by parent
    return events;
  }, [events, eventKey]);
  
  // Log when visible events change - only with DEBUG flag
  useEffect(() => {
    if (DEBUG) {
      console.log(`Visible events changed: now showing ${visibleEvents.length} events`);
    }
  }, [visibleEvents.length]);
  
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
  
  // Handle event click with proper parameter handling and error prevention
  const handleEventClick = useCallback((eventData) => {
    // Only call onEventClick if we have both the handler and valid event data
    if (onEventClick && eventData && typeof onEventClick === 'function') {
      if (DEBUG) console.log(`Handling click on event: ${eventData.id}`);
      onEventClick(eventData);
    } else if (DEBUG) {
      if (!onEventClick) console.log('No onEventClick handler provided');
      if (!eventData) console.log('No event data provided');
    }
  }, [onEventClick]);
  
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
    if (!currentMap) {
      console.log("No map data provided");
      return null;
    }
    
    // Prioritize file_url (cloud storage) over content_url if available
    let url = currentMap.file_url && currentMap.file_url.includes('storage.googleapis.com') 
      ? currentMap.file_url 
      : currentMap.content_url;
      
    // Fallback to content_url if no file_url
    if (!url) {
      url = currentMap.content_url;
    }
    
    // If still no URL, we can't render the map
    if (!url) {
      console.log("No URL available for map:", currentMap?.id, currentMap?.name);
      return null;
    }
    
    // Ensure URL uses HTTPS - critical for preventing mixed content warnings
    if (url.startsWith('http:')) {
      const oldUrl = url;
      url = url.replace('http:', 'https:');
      console.warn('Converted map URL from HTTP to HTTPS:', oldUrl, '→', url);
    }
    
    // For absolute URLs that don't include http/https, add https:// prefix
    if (!url.startsWith('http') && !url.startsWith('/') && (url.includes('.') || url.includes('localhost'))) {
      url = 'https://' + url;
      console.warn('Added HTTPS protocol to URL:', url);
    }
    
    const fileExt = url.split('.').pop().toLowerCase();
    const opacity = mapOpacities[currentMap.id] || (isOverlay ? 0.5 : 1.0);
    
    // Only log when debugging to avoid console spam
    if (DEBUG) {
      console.log(`Rendering map: ${currentMap.name}, ID: ${currentMap.id}, URL: ${url}, Extension: ${fileExt}`);
    }
    
    const layerStyle = {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      opacity: opacity,
      zIndex: zIndex,
      pointerEvents: 'none', // Let clicks pass through to the base container - CRITICAL for markers to work
    };
    
    // Use a reference to track if this layer has already been loaded
    const layerKey = `map-layer-${currentMap.id}`;
    
    if (fileExt === 'pdf') {
      // For PDFs, use an iframe with direct embed and hide UI controls
      return (
        <div key={layerKey} style={layerStyle} className="pdf-container">
          <iframe 
            src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} 
            title={currentMap.name}
            style={{ 
              width: '100%', 
              height: '100%', 
              border: 'none',
              backgroundColor: 'transparent',
              pointerEvents: 'none' // Ensure iframe doesn't capture pointer events
            }}
            frameBorder="0"
            onLoad={(e) => {
              // Only trigger handleImageLoad once per iframe to prevent re-rendering loops
              if (!imageLoaded) {
                handleImageLoad(e);
              }
            }}
            onError={(e) => {
              console.error(`Error loading map from URL: ${url}`, e);
              handleImageError();
            }}
            className="consistent-pdf-view"
          />
        </div>
      );
    } else if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(fileExt)) {
      // For images, contain them in their container with consistent scaling
      return (
        <div key={layerKey} style={layerStyle} className="map-image-container">
          <img 
            src={url} 
            alt={currentMap.name} 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain',
              pointerEvents: 'none' // Ensure image doesn't capture pointer events
            }}
            onLoad={(e) => {
              // Only trigger handleImageLoad once per image to prevent re-rendering loops
              if (!imageLoaded) {
                handleImageLoad(e);
              }
            }}
            onError={(e) => {
              console.error(`Error loading map image from URL: ${url}`, e);
              handleImageError();
            }}
            className="consistent-map-image"
          />
        </div>
      );
    } else {
      // For other file types, use a generic iframe
      return (
        <div key={layerKey} style={layerStyle}>
          <iframe 
            src={url} 
            className="map-iframe-container consistent-iframe-view"
            title={currentMap.name}
            style={{ 
              width: '100%', 
              height: '100%', 
              border: 'none',
              pointerEvents: 'none' // Ensure iframe doesn't capture pointer events
            }}
            onLoad={(e) => {
              // Only trigger handleImageLoad once per iframe to prevent re-rendering loops
              if (!imageLoaded) {
                handleImageLoad(e);
              }
            }}
            onError={(e) => {
              console.error(`Error loading map content from URL: ${url}`, e);
              handleImageError();
            }}
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
      console.log('MapDetail: Touch start event', isSelectingLocation ? '(in location selection mode)' : '');
      
      // Don't handle touch events when in selecting location mode
      if (isSelectingLocation) {
        console.log('MapDetail: Not handling touch in location selection mode');
        return;
      }
      
      const touches = e.touches;
      
      if (touches.length === 2) {
        // Two finger touch - start pinch gesture
        setIsPinching(true);
        const touch1 = touches[0];
        const touch2 = touches[1];
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
      // Don't handle touch events when in selecting location mode
      if (isSelectingLocation) {
        return;
      }
      
      const touches = e.touches;
      
      if (touches.length === 2 && isPinching) {
        e.preventDefault(); // Prevent default browser pinch zoom
        
        const touch1 = touches[0];
        const touch2 = touches[1];
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
      // Don't handle touch events when in selecting location mode
      if (isSelectingLocation) {
        return;
      }
      
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
  }, [isMobile, isPinching, mobilePanZoomScale, isSelectingLocation]);
  
  // Add a unified touch handler for mobile that handles both modes
  useEffect(() => {
    if (!isMobile || !mapContainerRef.current) return;
    
    const container = mapContainerRef.current;
    
    const handleUnifiedTouchEnd = (e) => {
      console.log(`MapDetail: Touch end detected, isSelectingLocation=${isSelectingLocation}`);
      
      // Only handle single-finger touches for location selection
      if (isSelectingLocation && e.changedTouches && e.changedTouches.length === 1) {
        console.log('MapDetail: Processing touch end in location selection mode');
        e.preventDefault();
        e.stopPropagation();
        
        if (!mapContentRef.current) {
          console.warn('Map content reference is null, cannot calculate touch coordinates');
          return;
        }
        
        const touch = e.changedTouches[0];
        const rect = mapContentRef.current.getBoundingClientRect();
        
        // Calculate position relative to map content
        const x = (touch.clientX - rect.left) / (viewportScale * mobilePanZoomScale);
        const y = (touch.clientY - rect.top) / (viewportScale * mobilePanZoomScale);
        
        // Check if the touch is within the map content bounds
        if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
          console.log(`MapDetail: Valid map location selected at (${x.toFixed(2)}, ${y.toFixed(2)})`);
          
          // Calculate coordinates as percentages of the map
          const xPercent = (x / contentSize.width) * 100;
          const yPercent = (y / contentSize.height) * 100;
          
          if (onMapClick) {
            console.log('MapDetail: Calling parent onMapClick handler');
            // Create enhanced map object with visible maps
            const mapWithVisibleLayers = {
              ...map,
              visibleMaps: visibleMaps
            };
            onMapClick(mapWithVisibleLayers, xPercent, yPercent);
          }
        } else {
          console.log('MapDetail: Touch outside map bounds, ignoring');
        }
      }
    };
    
    // Add the unified touch end listener with passive:false to allow preventDefault
    container.addEventListener('touchend', handleUnifiedTouchEnd, { passive: false });
    
    return () => {
      container.removeEventListener('touchend', handleUnifiedTouchEnd);
    };
  }, [isMobile, isSelectingLocation, map, onMapClick, viewportScale, mobilePanZoomScale, contentSize, visibleMaps]);
  
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
  }, [isSelectingLocation, showMobileControls]);
  
  // Function to render map content with layers
  const renderMapContent = () => {
    // Check if we have a valid map with URL
    const hasValidMap = implantationMap && (
      (implantationMap.file_url && implantationMap.file_url.includes('storage.googleapis.com')) || 
      implantationMap.content_url
    );
    
    if (!hasValidMap) {
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
          className="map-content-container" 
          ref={mapContainerRef}
          style={containerSize}
          onClick={(e) => {
            console.log(`MapDetail onClick: isSelectingLocation=${isSelectingLocation}, isMobile=${isMobile}`);
            
            // Skip all click handling on mobile - we handle it with touch events
            if (isMobile) {
              console.log('MapDetail: Ignoring click event on mobile - using touch events instead');
              return;
            }
            
            // Desktop click handling:
            if (isSelectingLocation && mapContentRef.current) {
              // Calculate click position relative to map content
              const rect = mapContentRef.current.getBoundingClientRect();
              const x = (e.clientX - rect.left) / viewportScale;
              const y = (e.clientY - rect.top) / viewportScale;
              
              console.log(`MapDetail click position: x=${x}, y=${y}`);
              
              // Pass the click coordinates to the parent component
              onMapClick && onMapClick(map, x, y);
            }
          }}
        >
          <div ref={mapContentRef} style={{
            ...contentStyle,
            pointerEvents: 'none' // Make the content itself not capture pointer events
          }} className="map-content">
            {renderMapLayer(implantationMap, 0)}
            {overlayMapObjects.map(m => renderMapLayer(m, 1, true))}

            {/* Render events as markers - add a specific container to create proper stacking context */}
            {imageLoaded && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 1000,
                pointerEvents: 'none'
              }}>
                {visibleEvents && visibleEvents.map((event) => {
                  // Extract numeric coordinates, ensure they're numbers
                  const xCoord = parseFloat(event.x_coordinate || event.location_x);
                  const yCoord = parseFloat(event.y_coordinate || event.location_y);
                  
                  console.log(`Rendering marker for event ${event.id}`, {
                    id: event.id,
                    title: event.title || event.name,
                    x: xCoord,
                    y: yCoord,
                    raw_x: event.x_coordinate,
                    raw_y: event.y_coordinate,
                    raw_location_x: event.location_x,
                    raw_location_y: event.location_y
                  });
                  
                  // Skip rendering if coordinates are not valid numbers
                  if (isNaN(xCoord) || isNaN(yCoord)) {
                    console.warn(`Invalid coordinates for event ${event.id}: x=${xCoord}, y=${yCoord}`);
                    return null;
                  }
                  
                  return (
                    <EventMarker
                      key={`event-${event.id}-${eventKey}`}
                      event={event}
                      x={xCoord}
                      y={yCoord}
                      viewportScale={viewportScale}
                      isMobile={isMobile}
                      onClick={() => handleEventClick(event)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </>
    );
  };
  
  // Completely separated map layer rendering function
  const renderMapLayers = () => {
    if (!overlayMaps.length) return null;
    
    if (isMobile && !showMobileControls) {
      // For mobile, only render the floating button when not showing controls
      return (
        <Button 
          variant="primary"
          onClick={toggleMobileControls}
          className="toggle-layers-btn"
          style={{
            position: 'fixed',
            bottom: '85px',
            right: '20px',
            zIndex: 1000,
            borderRadius: '50%',
            width: '50px',
            height: '50px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          <span>LAYERS</span>
        </Button>
      );
    }
    
    const layerStyles = isMobile ? {
      position: 'fixed',
      bottom: '20px',
      right: '20px', 
      left: '20px',
      zIndex: 1001,
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
      maxHeight: '80vh'
    } : {
      position: 'relative',
      width: '100%',
      padding: '15px',
      backgroundColor: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: '5px'
    };
    
    return (
      (!isMobile || showMobileControls) && (
        <div className="map-layers-control" style={layerStyles}>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5 className="m-0">{translate('Map Layers')}</h5>
            {isMobile && (
              <Button 
                variant="link" 
                className="p-0 text-secondary" 
                onClick={toggleMobileControls}
                aria-label="Close"
              >
                X
              </Button>
            )}
          </div>
          <ListGroup>
            {/* Always show implantation map at the top */}
            {implantationMap && (
              <ListGroup.Item 
                key={`layer-${implantationMap.id}`} 
                className="d-flex justify-content-between align-items-center"
              >
                <div className="d-flex align-items-center">
                  <Form.Check
                    type="checkbox"
                    checked={visibleMaps.includes(implantationMap.id)}
                    disabled={true} // Can't toggle the main map
                    label={`${implantationMap.name} (${translate('Main')})`}
                    id={`map-layer-${implantationMap.id}`}
                  />
                </div>
                <Form.Range
                  value={mapOpacities[implantationMap.id] * 100}
                  onChange={(e) => handleOpacityChange(implantationMap.id, parseInt(e.target.value, 10))}
                  min={20}
                  max={100}
                  className="opacity-slider"
                />
              </ListGroup.Item>
            )}
            
            {/* Then show all overlay maps */}
            {overlayMaps.map(map => (
              <ListGroup.Item 
                key={`layer-${map.id}`} 
                className="d-flex justify-content-between align-items-center"
              >
                <div className="d-flex align-items-center">
                  <Form.Check
                    type="checkbox"
                    checked={visibleMaps.includes(map.id)}
                    onChange={() => toggleMapVisibility(map.id)}
                    label={map.name}
                    id={`map-layer-${map.id}`}
                  />
                </div>
                {visibleMaps.includes(map.id) && (
                  <Form.Range
                    value={mapOpacities[map.id] * 100}
                    onChange={(e) => handleOpacityChange(map.id, parseInt(e.target.value, 10))}
                    min={20}
                    max={100}
                    className="opacity-slider"
                  />
                )}
              </ListGroup.Item>
            ))}
          </ListGroup>
        </div>
      )
    );
  };
  
  // Mobile toggle button only - keep separate for clean structure
  const renderMobileToggleButton = () => {
    if (!isMobile || !overlayMaps.length || showMobileControls) return null;
    
    return (
      <Button 
        variant="primary"
        onClick={toggleMobileControls}
        className="toggle-layers-btn"
        style={{
          position: 'fixed',
          bottom: '85px',
          right: '20px',
          zIndex: 1000,
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
          fontSize: '12px',
          fontWeight: 'bold'
        }}
      >
        <span>LAYERS</span>
      </Button>
    );
  };
  
  return (
    <div className="map-detail-container" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100%',
      paddingBottom: '200px' // Add substantial padding at the bottom
    }}>
      <div className="map-content-section" style={{ 
        position: 'relative', 
        flex: '1 0 auto',
        marginBottom: '50px' // Add space below the map content
      }}>
        {renderMapContent()}
        {isMobile && renderMobileToggleButton()}
      </div>
      
      {/* Separate section for map layers in desktop view */}
      {!isMobile && (
        <div className="map-layers-section" style={{ 
          marginTop: '750px', // Much larger top margin to push it down
          marginBottom: '200px', // Larger bottom margin too
          padding: '30px', // More padding to make it easier to see
          border: '1px solid #eee',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9',
          width: '80%', // Make it a bit narrower than the full width
          alignSelf: 'center' // Center it horizontally
        }}>
          {renderMapLayers()}
        </div>
      )}
      
      {/* Mobile layers are rendered with fixed positioning */}
      {isMobile && showMobileControls && renderMapLayers()}
    </div>
  );
};

export default MapDetail;