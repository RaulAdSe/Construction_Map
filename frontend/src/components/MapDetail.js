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
        height: (contentRect.height || 900) * 1 // Apply height adjustment only once
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
  
  // Helper functions for event type detection - consistent with filter logic
  const isIncidence = (event) => {
    if (!event || !event.state) return false;
    const state = (event.state || '').toLowerCase();
    return state === 'incidence' || state.includes('incidence');
  };
  
  const isCheck = (event) => {
    if (!event || !event.state) return false;
    const state = (event.state || '').toLowerCase();
    
    // Expanded matching to catch more variations
    const checkVariations = [
      'periodic check', 
      'check',
      'periodic',
      'revisión',
      'revision',
      'inspección',
      'inspeccion',
      'inspection',
      'mantenimiento',
      'maintenance'
    ];
    
    // Check if any of our variations are found in the state
    return checkVariations.some(variation => 
      state === variation || state.includes(variation)
    );
  };
  
  const isRequest = (event) => {
    if (!event || !event.state) return false;
    const state = (event.state || '').toLowerCase();
    return state === 'request' || state.includes('request');
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
    
    // Debug log for contentSize to help with troubleshooting
    console.log('Map Content Size:', contentSize, 'Initial Content Size:', initialContentSize.current);
    
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
            
            // Close mobile layer controls when clicking on map
            if (isMobile && showMobileControls) {
              setShowMobileControls(false);
            }
            
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
          {/* Map content layers - ALL map layers have pointer-events: none */}
          <div ref={mapContentRef} style={{
            ...contentStyle,
            pointerEvents: 'none', // Make the content itself not capture pointer events
            zIndex: 1 // Low z-index for map layers
          }} className="map-content">
            {renderMapLayer(implantationMap, 0)}
            {overlayMapObjects.map(m => renderMapLayer(m, 1, true))}
          </div>
          
          {/* DEDICATED MARKER CONTAINER - positioned exactly like map content but with higher z-index */}
          <div 
            style={{
              ...contentStyle,
              pointerEvents: 'none', // Container passes events through by default
              overflow: 'visible',
              zIndex: 9999
            }} 
            className="marker-positioning-container"
          >
            {visibleEvents && visibleEvents.map((event) => {
              const normalizedCoords = normalizeEventCoordinates(event);
              
              if (!normalizedCoords) {
                console.warn(`Skipping marker for event ${event.id} due to invalid coordinates`);
                return null;
              }
              
              const { x, y } = normalizedCoords;
              
              // Determine marker color based on event type
              const markerColor = isIncidence(event) ? '#FF0000' : 
                          isCheck(event) ? '#3399FF' : 
                          isRequest(event) ? '#9966CC' : '#FF9900';
              
              // Create a direct DOM marker with guaranteed visibility and interactivity
              return (
                <div
                  key={`event-marker-${event.id}`}
                  className="event-marker"
                  style={{
                    position: 'absolute',
                    left: `${x}%`,
                    top: `${y}%`,
                    width: '20px',
                    height: '20px',
                    backgroundColor: markerColor,
                    borderRadius: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 999,
                    pointerEvents: 'auto !important',
                    cursor: 'pointer',
                    border: '3px solid white',
                    boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
                    display: 'block !important',
                    visibility: 'visible !important'
                  }}
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event from bubbling
                    console.log(`Marker clicked for event ${event.id}`);
                    handleEventClick(event);
                  }}
                  title={event.title || event.name || `Event #${event.id}`}
                  data-event-id={event.id}
                  data-x-coord={x}
                  data-y-coord={y}
                />
              );
            })}
          </div>
          
          {/* DEBUG INFO - Fixed position at top */}
          {DEBUG && (
            <div className="debug-marker-info" style={{
              position: 'absolute',
              top: '5px',
              left: '5px',
              background: 'rgba(0,0,0,0.7)',
              color: 'white',
              padding: '5px',
              borderRadius: '5px',
              fontSize: '12px',
              zIndex: 10001,
              pointerEvents: 'auto'
            }}>
              Map size: {contentSize.width}x{contentSize.height} | Scale: {viewportScale.toFixed(2)} | 
              Events: {visibleEvents?.length || 0}
            </div>
          )}
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
      bottom: '70px', // Increased from 20px to 70px to position it lower
      right: '20px', 
      left: '20px',
      zIndex: 10001, // Increased from 1001 to be higher than markers (10000)
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
      maxHeight: '70vh' // Reduced from 80vh to 70vh to make it shorter
    } : {
      position: 'relative',
      padding: '15px',
      backgroundColor: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: '8px',
      boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
    };
    
    return (
      <div className="map-layers-container" style={{
        ...layerStyles,
        marginTop: '80px', // Reduced from 200px
        marginBottom: '30px', // Reduced from 50px
        width: 'auto', // Auto width instead of fixed 80%
        maxWidth: '500px', // Add max-width for larger screens
        margin: '80px auto 30px auto', // Adjusted margins
        padding: '20px', // Reduced padding
      }}>
        <h5 style={{ marginBottom: '15px', fontSize: '16px', fontWeight: '600' }}>{translate('Map Layers')}</h5>
        <ListGroup variant="flush">
          {/* Main map item */}
          {implantationMap && (
            <ListGroup.Item className="main-map-item py-2" style={{ border: 'none', borderBottom: '1px solid #eee' }}>
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong style={{ fontSize: '14px' }}>{implantationMap.name || translate('Main Map')}</strong>
                  <small className="d-block text-muted" style={{ fontSize: '12px' }}>{translate('Base layer (always visible)')}</small>
                </div>
                <Form.Range
                  value={mapOpacities[implantationMap.id] * 100 || 100}
                  onChange={(e) => handleOpacityChange(implantationMap.id, parseInt(e.target.value))}
                  style={{ width: '100px' }}
                />
              </div>
            </ListGroup.Item>
          )}
          
          {/* Overlay maps */}
          {overlayMaps.map(map => (
            <ListGroup.Item key={map.id} className="d-flex justify-content-between align-items-center py-2" style={{ border: 'none', borderBottom: '1px solid #eee' }}>
              <Form.Check 
                type="checkbox"
                id={`map-toggle-${map.id}`}
                label={
                  <div>
                    <span style={{ fontSize: '14px' }}>{map.name || `Map #${map.id}`}</span>
                    <small className="d-block text-muted" style={{ fontSize: '12px' }}>
                      {map.map_type ? translate(map.map_type) : translate('Overlay')}
                    </small>
                  </div>
                }
                checked={visibleMaps.includes(map.id)}
                onChange={() => toggleMapVisibility(map.id)}
              />
              
              {visibleMaps.includes(map.id) && (
                <Form.Range
                  value={mapOpacities[map.id] * 100 || 50}
                  onChange={(e) => handleOpacityChange(map.id, parseInt(e.target.value))}
                  style={{ width: '100px' }}
                />
              )}
            </ListGroup.Item>
          ))}
        </ListGroup>
      </div>
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
  
  // Update normalizeEventCoordinates function
  const normalizeEventCoordinates = (event) => {
    if (!event) {
      console.warn('Invalid event:', event);
      return null;
    }

    let x, y;
    
    // Try different coordinate properties in priority order
    if (typeof event.x_coordinate !== 'undefined' && event.x_coordinate !== null) {
      x = parseFloat(event.x_coordinate);
      y = parseFloat(event.y_coordinate);
    } else if (typeof event.location_x !== 'undefined' && event.location_x !== null) {
      x = parseFloat(event.location_x);
      y = parseFloat(event.location_y);
    } else if (event.coordinates) {
      // Parse coordinates based on format (could be stored as string, object, or already as numbers)
      if (typeof event.coordinates === 'string') {
        try {
          const coordObj = JSON.parse(event.coordinates);
          x = parseFloat(coordObj.x || coordObj.X || 0);
          y = parseFloat(coordObj.y || coordObj.Y || 0);
        } catch (e) {
          // Try comma-separated format
          const parts = event.coordinates.split(',');
          x = parseFloat(parts[0] || 0);
          y = parseFloat(parts[1] || 0);
        }
      } else if (typeof event.coordinates === 'object') {
        x = parseFloat(event.coordinates.x || event.coordinates.X || 0);
        y = parseFloat(event.coordinates.y || event.coordinates.Y || 0);
      }
    } else {
      console.warn(`No valid coordinates found for event ${event.id || 'unknown'}`, event);
      return null;
    }

    // Log original coordinates for debugging
    console.log(`Original coordinates for event ${event.id || 'unknown'}: x=${x}, y=${y}`);

    // Detect if coordinates are in pixels (large numbers) and convert to percentages
    if (!isNaN(x) && !isNaN(y) && contentSize.width > 0 && contentSize.height > 0) {
      // If x or y is greater than 100, assume it's in pixels and convert to percentage
      if (x > 100 || y > 100) {
        console.log(`Converting from pixels to percentages: x=${x}, y=${y}`);
        x = (x / contentSize.width) * 100;
        y = (y / contentSize.height) * 100;
      }
    }

    // Ensure we have valid numbers
    if (isNaN(x) || isNaN(y)) {
      console.warn(`Invalid coordinate values: x=${x}, y=${y}`);
      return null;
    }

    // Clamp values to 0-100% range to ensure markers stay within map bounds
    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    console.log(`Normalized coordinates for event ${event.id || 'unknown'}: x=${x.toFixed(2)}%, y=${y.toFixed(2)}%`);
    return { x, y };
  };

  const contentRef = useRef(null);

  // Add useEffect for measuring content size
  useEffect(() => {
    if (!contentRef.current) return;

    const updateContentSize = () => {
      const { width, height } = contentRef.current.getBoundingClientRect();
      setContentSize({ width, height });
      console.log('Updated map content size:', { width, height });
    };

    // Initial measurement
    updateContentSize();

    // Set up ResizeObserver to track size changes
    const resizeObserver = new ResizeObserver(updateContentSize);
    resizeObserver.observe(contentRef.current);

    return () => {
      if (contentRef.current) {
        resizeObserver.unobserve(contentRef.current);
      }
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="map-detail-container" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100%',
      paddingBottom: '300px'
    }}>
      <div className="map-content-section" style={{ 
        position: 'relative', 
        flex: '1 0 auto',
        marginBottom: '120px',
        minHeight: '700px'
      }}>
        {renderMapContent()}
        {isMobile && renderMobileToggleButton()}
      </div>
      
      {/* Separate section for map layers in desktop view - completely below map with clear spacing */}
      {!isMobile && (
        <div className="map-layers-section" style={{ 
          marginTop: '100px',
          marginBottom: '100px',
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          paddingRight: '0',
        }}>
          <div style={{
            maxWidth: '400px',
            width: '100%',
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
            padding: '20px',
          }}>
            <h5 style={{ marginBottom: '15px', fontSize: '16px', fontWeight: '600', textAlign: 'center' }}>{translate('Map Layers')}</h5>
            <ListGroup variant="flush">
              {/* Main map item */}
              {implantationMap && (
                <ListGroup.Item className="main-map-item py-2" style={{ border: 'none', borderBottom: '1px solid #eee' }}>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <strong style={{ fontSize: '14px' }}>{implantationMap.name || translate('Main Map')}</strong>
                      <small className="d-block text-muted" style={{ fontSize: '12px' }}>{translate('Base layer (always visible)')}</small>
                    </div>
                    <Form.Range
                      value={mapOpacities[implantationMap.id] * 100 || 100}
                      onChange={(e) => handleOpacityChange(implantationMap.id, parseInt(e.target.value))}
                      style={{ width: '100px' }}
                    />
                  </div>
                </ListGroup.Item>
              )}
              
              {/* Overlay maps */}
              {overlayMaps.map(map => (
                <ListGroup.Item key={map.id} className="d-flex justify-content-between align-items-center py-2" style={{ border: 'none', borderBottom: '1px solid #eee' }}>
                  <Form.Check 
                    type="checkbox"
                    id={`map-toggle-${map.id}`}
                    label={
                      <div>
                        <span style={{ fontSize: '14px' }}>{map.name || `Map #${map.id}`}</span>
                        <small className="d-block text-muted" style={{ fontSize: '12px' }}>
                          {map.map_type ? translate(map.map_type) : translate('Overlay')}
                        </small>
                      </div>
                    }
                    checked={visibleMaps.includes(map.id)}
                    onChange={() => toggleMapVisibility(map.id)}
                  />
                  
                  {visibleMaps.includes(map.id) && (
                    <Form.Range
                      value={mapOpacities[map.id] * 100 || 50}
                      onChange={(e) => handleOpacityChange(map.id, parseInt(e.target.value))}
                      style={{ width: '100px' }}
                    />
                  )}
                </ListGroup.Item>
              ))}
            </ListGroup>
          </div>
        </div>
      )}
      
      {/* Mobile layers are rendered with fixed positioning */}
      {isMobile && showMobileControls && renderMapLayers()}
      
      {/* Add this CSS to ensure markers are visible */}
      <style jsx>{`
        .event-marker {
          visibility: visible !important;
          z-index: 9999 !important;
          pointer-events: auto !important;
        }
      `}</style>
    </div>
  );
};

export default MapDetail;