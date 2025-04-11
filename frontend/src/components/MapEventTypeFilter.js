import React, { useState, useEffect } from 'react';
import { Form } from 'react-bootstrap';
import translate from '../utils/translate';
import { useMobile } from './common/MobileProvider';

/**
 * MapEventTypeFilter - A minimal component to filter event types displayed on the map
 * 
 * @param {Object} props
 * @param {Array} props.events - All events
 * @param {Function} props.onFilterChange - Callback when filter changes
 */
const MapEventTypeFilter = ({ events, onFilterChange }) => {
  const { isMobile } = useMobile();
  
  // Default all types to checked
  const [selectedTypes, setSelectedTypes] = useState({
    'incidence': true,
    'periodic check': true,
    'request': true
  });

  // Filter events whenever selection changes
  useEffect(() => {
    const filteredEvents = events.filter(event => 
      event.state && selectedTypes[event.state]
    );
    
    if (onFilterChange) {
      onFilterChange(filteredEvents);
    }
  }, [selectedTypes, events, onFilterChange]);

  const handleTypeChange = (e) => {
    const { name, checked } = e.target;
    setSelectedTypes(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  // Calculate counts for each type
  const typeCounts = {
    'incidence': events.filter(e => e.state === 'incidence').length,
    'periodic check': events.filter(e => e.state === 'periodic check').length,
    'request': events.filter(e => e.state === 'request').length
  };

  return (
    <div className="map-event-filter p-2" style={{ 
      fontSize: '0.85em',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderRadius: '8px',
      border: '1px solid #dee2e6',
      marginBottom: '10px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
    }}>
      <div className="d-flex flex-wrap align-items-center">
        <Form.Check 
          type="checkbox"
          id="filter-incidence"
          name="incidence"
          label={`${translate('Incidences')} (${typeCounts['incidence']})`}
          checked={selectedTypes['incidence']}
          onChange={handleTypeChange}
          className="me-2 mb-1"
          style={{ whiteSpace: 'nowrap' }}
        />
        <Form.Check 
          type="checkbox"
          id="filter-periodic-check"
          name="periodic check"
          label={`${translate('Checks')} (${typeCounts['periodic check']})`}
          checked={selectedTypes['periodic check']}
          onChange={handleTypeChange}
          className="me-2 mb-1"
          style={{ whiteSpace: 'nowrap' }}
        />
        <Form.Check 
          type="checkbox"
          id="filter-request"
          name="request"
          label={`${translate('Requests')} (${typeCounts['request']})`}
          checked={selectedTypes['request']}
          onChange={handleTypeChange}
          className="mb-1"
          style={{ whiteSpace: 'nowrap' }}
        />
      </div>
    </div>
  );
};

export default MapEventTypeFilter; 