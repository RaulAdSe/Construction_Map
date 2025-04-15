import React, { useState, useEffect } from 'react';
import { Form, Card, Row, Col } from 'react-bootstrap';
import translate from '../utils/translate';

/**
 * MapMinimalFilter - A minimalist component to filter events displayed on the map
 * 
 * @param {Object} props
 * @param {Array} props.events - All events
 * @param {Function} props.onFilterChange - Callback when filter changes
 */
const MapMinimalFilter = ({ events, onFilterChange }) => {
  // Default filter settings
  const [filters, setFilters] = useState({
    status: {
      open: true,
      closed: false
    },
    priority: {
      high: true,
      medium: true,
      low: true
    }
  });

  // Filter events whenever selection changes
  useEffect(() => {
    const filteredEvents = events.filter(event => {
      // Status filter (open/closed)
      const statusMatch = 
        (event.status === 'open' && filters.status.open) ||
        (event.status === 'closed' && filters.status.closed);
      
      // Priority filter
      const priorityMatch = 
        (event.priority === 'high' && filters.priority.high) ||
        (event.priority === 'medium' && filters.priority.medium) ||
        (event.priority === 'low' && filters.priority.low);
      
      return statusMatch && priorityMatch;
    });
    
    if (onFilterChange) {
      onFilterChange(filteredEvents);
    }
  }, [filters, events, onFilterChange]);

  const handleStatusChange = (e) => {
    const { name, checked } = e.target;
    setFilters(prev => ({
      ...prev,
      status: {
        ...prev.status,
        [name]: checked
      }
    }));
  };

  const handlePriorityChange = (e) => {
    const { name, checked } = e.target;
    setFilters(prev => ({
      ...prev,
      priority: {
        ...prev.priority,
        [name]: checked
      }
    }));
  };

  // Calculate counts for status and priority
  const counts = {
    status: {
      open: events.filter(e => e.status === 'open').length,
      closed: events.filter(e => e.status === 'closed').length
    },
    priority: {
      high: events.filter(e => e.priority === 'high').length,
      medium: events.filter(e => e.priority === 'medium').length,
      low: events.filter(e => e.priority === 'low').length
    }
  };

  return (
    <Card className="map-filter-card mb-3" style={{ fontSize: '0.9em' }}>
      <Card.Body className="p-2">
        <Form>
          <div className="filter-section mb-2">
            <div className="filter-heading mb-1">{translate('Status')}</div>
            <Row>
              <Col xs={6}>
                <Form.Check 
                  type="checkbox"
                  id="filter-status-open"
                  name="open"
                  label={`${translate('Open')} (${counts.status.open})`}
                  checked={filters.status.open}
                  onChange={handleStatusChange}
                  className="mb-1"
                />
              </Col>
              <Col xs={6}>
                <Form.Check 
                  type="checkbox"
                  id="filter-status-closed"
                  name="closed"
                  label={`${translate('Closed')} (${counts.status.closed})`}
                  checked={filters.status.closed}
                  onChange={handleStatusChange}
                  className="mb-1"
                />
              </Col>
            </Row>
          </div>

          <div className="filter-section">
            <div className="filter-heading mb-1">{translate('Priority')}</div>
            <Form.Check 
              type="checkbox"
              id="filter-priority-high"
              name="high"
              label={`${translate('High')} (${counts.priority.high})`}
              checked={filters.priority.high}
              onChange={handlePriorityChange}
              className="mb-1"
            />
            <Form.Check 
              type="checkbox"
              id="filter-priority-medium"
              name="medium"
              label={`${translate('Medium')} (${counts.priority.medium})`}
              checked={filters.priority.medium}
              onChange={handlePriorityChange}
              className="mb-1"
            />
            <Form.Check 
              type="checkbox"
              id="filter-priority-low"
              name="low"
              label={`${translate('Low')} (${counts.priority.low})`}
              checked={filters.priority.low}
              onChange={handlePriorityChange}
              className="mb-1"
            />
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default MapMinimalFilter; 