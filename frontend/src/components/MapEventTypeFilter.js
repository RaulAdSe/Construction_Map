import React, { useState, useEffect, useRef } from 'react';
import { Form } from 'react-bootstrap';
import translate from '../utils/translate';
import { useMobile } from './common/MobileProvider';

/**
 * MapEventTypeFilter - Filter component for event types on the map
 * 
 * @param {Object} props
 * @param {Array} props.events - All events available
 * @param {Function} props.onFilterChange - Callback when filter changes
 */
const MapEventTypeFilter = ({ events, onFilterChange }) => {
  const { isMobile } = useMobile();
  
  // Store all events to filter against
  const allEventsRef = useRef(events || []);
  
  // Update stored events when prop changes
  useEffect(() => {
    if (events && Array.isArray(events)) {
      allEventsRef.current = events;
    }
  }, [events]);
  
  // Default all types to checked (true)
  const [selectedTypes, setSelectedTypes] = useState({
    'incidence': true,
    'periodic check': true,
    'request': true
  });

  // Calculate counts for each type - always from the full dataset
  const typeCounts = {
    'incidence': allEventsRef.current.filter(e => e?.state === 'incidence').length || 0,
    'periodic check': allEventsRef.current.filter(e => e?.state === 'periodic check').length || 0,
    'request': allEventsRef.current.filter(e => e?.state === 'request').length || 0
  };

  // Debug counter to track filter operations
  const [filterCounter, setFilterCounter] = useState(0);
  
  // Apply filter whenever selection changes
  useEffect(() => {
    // Skip if no callback
    if (!onFilterChange) return;
    
    // Filter based on currently selected types
    const filteredEvents = allEventsRef.current.filter(event => {
      // Skip if event has no state
      if (!event || !event.state) return false;
      
      // Include event if its type is checked in the filter
      return selectedTypes[event.state] === true;
    });
    
    // Apply the filter and increment counter
    onFilterChange(filteredEvents, filterCounter);
    setFilterCounter(prev => prev + 1);
    
    // Debug logging
    console.log(`Filter operation #${filterCounter} applied:`, {
      selectedTypes,
      filteredCount: filteredEvents.length,
      totalCount: allEventsRef.current.length
    });
      
  }, [selectedTypes, onFilterChange, filterCounter]);

  // Handle checkbox state changes
  const handleTypeChange = (e) => {
    const { name, checked } = e.target;
    console.log(`Filter toggle: ${name} = ${checked}, current events: ${typeCounts[name]}`);
    
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