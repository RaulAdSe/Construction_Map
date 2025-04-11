import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Form } from 'react-bootstrap';
import translate from '../utils/translate';
import { useMobile } from './common/MobileProvider';

const DEBUG = false; // Set to false for production

/**
 * MapEventTypeFilter - Filter component for event types on the map
 * 
 * @param {Object} props
 * @param {Array} props.events - All events available
 * @param {Function} props.onFilterChange - Callback when filter changes
 */
const MapEventTypeFilter = ({ events, onFilterChange }) => {
  const { isMobile } = useMobile();
  
  // Store original events to filter against
  const eventsRef = useRef(events || []);
  
  // Track last filtered result to avoid duplicate updates
  const lastFilteredRef = useRef(null);
  
  // Update ref when events prop changes (only store the reference, don't cause rerenders)
  useEffect(() => {
    if (events && Array.isArray(events)) {
      eventsRef.current = events;
    }
  }, [events]);
  
  // Default all types to checked (true)
  const [selectedTypes, setSelectedTypes] = useState({
    'incidence': true,
    'periodic check': true,
    'request': true
  });

  // Memoize the filter function to avoid recreating it on every render
  const filterEvents = useCallback(() => {
    const currentEvents = eventsRef.current || [];
    
    return currentEvents.filter(event => {
      // Skip if event has no state
      if (!event || !event.state) return false;
      
      // Include event if its type is checked in the filter
      return selectedTypes[event.state] === true;
    });
  }, [selectedTypes]);

  // Only filter events when selectedTypes changes
  useEffect(() => {
    // Skip if no callback
    if (!onFilterChange) return;
    
    // Get filtered events
    const filteredEvents = filterEvents();
    
    // Compare with last filtered result
    const currentFilterKey = JSON.stringify(filteredEvents.map(e => e?.id).sort());
    if (lastFilteredRef.current === currentFilterKey) {
      if (DEBUG) console.log("Filter unchanged, skipping update");
      return;
    }
    
    // Update last filtered reference
    lastFilteredRef.current = currentFilterKey;
    
    // Call the filter change handler with filtered events
    if (DEBUG) console.log(`Filtering applied: ${filteredEvents.length} events selected`);
    onFilterChange(filteredEvents);
  }, [filterEvents, onFilterChange]);

  // Calculate counts for each type
  const typeCounts = {
    'incidence': events?.filter(e => e?.state === 'incidence')?.length || 0,
    'periodic check': events?.filter(e => e?.state === 'periodic check')?.length || 0,
    'request': events?.filter(e => e?.state === 'request')?.length || 0
  };

  // Handle checkbox state changes
  const handleTypeChange = (e) => {
    const { name, checked } = e.target;
    
    // Update the selected types state with the new checkbox value
    setSelectedTypes(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  return (
    <div className="map-event-filter p-1" style={{ 
      fontSize: '0.85em',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      borderRadius: '4px',
      border: '1px solid #dee2e6',
      marginBottom: '5px',
      display: 'flex',
      justifyContent: 'center',
      flexWrap: 'wrap'
    }}>
      <Form.Check 
        type="checkbox"
        id="filter-incidence"
        name="incidence"
        label={`${translate('Incidences')} (${typeCounts['incidence']})`}
        checked={selectedTypes['incidence']}
        onChange={handleTypeChange}
        className="me-2 mb-0"
        style={{ whiteSpace: 'nowrap' }}
      />
      <Form.Check 
        type="checkbox"
        id="filter-periodic-check"
        name="periodic check"
        label={`${translate('Checks')} (${typeCounts['periodic check']})`}
        checked={selectedTypes['periodic check']}
        onChange={handleTypeChange}
        className="me-2 mb-0"
        style={{ whiteSpace: 'nowrap' }}
      />
      <Form.Check 
        type="checkbox"
        id="filter-request"
        name="request"
        label={`${translate('Requests')} (${typeCounts['request']})`}
        checked={selectedTypes['request']}
        onChange={handleTypeChange}
        className="mb-0"
        style={{ whiteSpace: 'nowrap' }}
      />
    </div>
  );
};

export default MapEventTypeFilter; 