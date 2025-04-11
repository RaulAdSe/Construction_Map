import React, { useState, useEffect } from 'react';
import { Form } from 'react-bootstrap';
import translate from '../utils/translate';
import { useMobile } from './common/MobileProvider';

/**
 * MapEventTypeFilter - Filter component for event types on the map
 * Uses a direct approach to track selected types and notify parent
 */
const MapEventTypeFilter = ({ events, onFilterChange }) => {
  const { isMobile } = useMobile();
  
  // Count events by type
  const typeCounts = {
    'incidence': events.filter(e => e?.state === 'incidence').length || 0,
    'periodic check': events.filter(e => e?.state === 'periodic check').length || 0,
    'request': events.filter(e => e?.state === 'request').length || 0
  };
  
  // Track selected types with state
  const [selectedTypes, setSelectedTypes] = useState({
    'incidence': true,
    'periodic check': true,
    'request': true
  });
  
  // Notify parent when selection changes - DIRECTLY - no equality checks
  useEffect(() => {
    if (onFilterChange) {
      // Simply filter events based on current selection
      const filteredEvents = events.filter(event => 
        event && event.state && selectedTypes[event.state] === true
      );
      
      // No equality checks, just pass the filtered events directly
      onFilterChange(filteredEvents);
      
      // Log for debugging
      console.log(`Filter applied: ${Object.entries(selectedTypes)
        .filter(([_, checked]) => checked)
        .map(([type]) => type)
        .join(', ')} - ${filteredEvents.length} events`);
    }
  }, [selectedTypes, events, onFilterChange]);

  // Handle checkbox changes
  const handleTypeChange = (e) => {
    const { name, checked } = e.target;
    console.log(`Filter toggled: ${name} = ${checked}`);
    
    // Update selected types
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