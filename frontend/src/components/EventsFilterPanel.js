import React, { useState, useEffect } from 'react';
import { Form, Button, Card, Row, Col, Badge } from 'react-bootstrap';
import { format } from 'date-fns';
import translate from '../utils/translate';

/**
 * Filter panel for events table
 * @param {Object} props
 * @param {Array} props.events - Original unfiltered events
 * @param {Function} props.onFilterChange - Callback when filters change, receives filtered events
 * @param {Array} props.availableTags - All available tags from events
 */
const EventsFilterPanel = ({ events, onFilterChange, availableTags = [] }) => {
  // Filter states
  const [statusFilter, setStatusFilter] = useState([]);
  const [typeFilter, setTypeFilter] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  
  // Status options
  const statusOptions = [
    { value: 'open', label: translate('Open') },
    { value: 'in-progress', label: translate('In Progress') },
    { value: 'resolved', label: translate('Resolved') },
    { value: 'closed', label: translate('Closed') }
  ];
  
  // Type options
  const typeOptions = [
    { value: 'incidence', label: translate('Incidence') },
    { value: 'periodic check', label: translate('Periodic Check') },
    { value: 'request', label: translate('Request') }
  ];
  
  // Apply filters whenever filter criteria change
  useEffect(() => {
    applyFilters();
  }, [statusFilter, typeFilter, startDate, endDate, selectedTags, events]);
  
  // Filter events based on criteria
  const applyFilters = () => {
    if (!events || events.length === 0) {
      onFilterChange([]);
      return;
    }
    
    let filteredEvents = [...events];
    
    // Filter by status
    if (statusFilter.length > 0) {
      filteredEvents = filteredEvents.filter(event => 
        statusFilter.includes(event.status)
      );
    }
    
    // Filter by type
    if (typeFilter.length > 0) {
      filteredEvents = filteredEvents.filter(event => 
        typeFilter.includes(event.state)
      );
    }
    
    // Filter by date range
    if (startDate) {
      const startDateTime = new Date(startDate);
      filteredEvents = filteredEvents.filter(event => 
        new Date(event.created_at) >= startDateTime
      );
    }
    
    if (endDate) {
      const endDateTime = new Date(endDate);
      // Set the time to end of day
      endDateTime.setHours(23, 59, 59, 999);
      filteredEvents = filteredEvents.filter(event => 
        new Date(event.created_at) <= endDateTime
      );
    }
    
    // Filter by tags
    if (selectedTags.length > 0) {
      filteredEvents = filteredEvents.filter(event => {
        if (!event.tags || !Array.isArray(event.tags)) return false;
        return selectedTags.some(tag => event.tags.includes(tag));
      });
    }
    
    // Pass filtered events to parent
    onFilterChange(filteredEvents);
  };
  
  // Handle status filter changes
  const handleStatusChange = (e) => {
    const value = e.target.value;
    if (e.target.checked) {
      setStatusFilter([...statusFilter, value]);
    } else {
      setStatusFilter(statusFilter.filter(status => status !== value));
    }
  };
  
  // Handle type filter changes
  const handleTypeChange = (e) => {
    const value = e.target.value;
    if (e.target.checked) {
      setTypeFilter([...typeFilter, value]);
    } else {
      setTypeFilter(typeFilter.filter(type => type !== value));
    }
  };
  
  // Handle tag selection
  const handleTagSelect = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };
  
  // Reset all filters
  const handleReset = () => {
    setStatusFilter([]);
    setTypeFilter([]);
    setStartDate('');
    setEndDate('');
    setSelectedTags([]);
  };
  
  // Toggle panel expanded state
  const togglePanel = () => {
    setIsPanelExpanded(!isPanelExpanded);
  };
  
  // Get all tags from events
  const getAllTags = () => {
    if (!availableTags || availableTags.length === 0) {
      const tagSet = new Set();
      events?.forEach(event => {
        if (event.tags && Array.isArray(event.tags)) {
          event.tags.forEach(tag => tagSet.add(tag));
        }
      });
      return Array.from(tagSet);
    }
    return availableTags;
  };
  
  // Count active filters
  const getActiveFilterCount = () => {
    let count = 0;
    if (statusFilter.length > 0) count++;
    if (typeFilter.length > 0) count++;
    if (startDate || endDate) count++;
    if (selectedTags.length > 0) count++;
    return count;
  };
  
  return (
    <Card className="mb-3">
      <Card.Header onClick={togglePanel} style={{ cursor: 'pointer' }}>
        <div className="d-flex justify-content-between align-items-center">
          <span>
            {translate('Filters')}
            {getActiveFilterCount() > 0 && (
              <Badge pill bg="primary" className="ms-2">
                {getActiveFilterCount()}
              </Badge>
            )}
          </span>
          <span>{isPanelExpanded ? '▲' : '▼'}</span>
        </div>
      </Card.Header>
      {isPanelExpanded && (
        <Card.Body>
          <Row>
            <Col md={3}>
              <Form.Group className="mb-3">
                <Form.Label>{translate('Status')}</Form.Label>
                {statusOptions.map(option => (
                  <Form.Check
                    key={option.value}
                    type="checkbox"
                    id={`status-${option.value}`}
                    label={option.label}
                    value={option.value}
                    checked={statusFilter.includes(option.value)}
                    onChange={handleStatusChange}
                  />
                ))}
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className="mb-3">
                <Form.Label>{translate('Type')}</Form.Label>
                {typeOptions.map(option => (
                  <Form.Check
                    key={option.value}
                    type="checkbox"
                    id={`type-${option.value}`}
                    label={option.label}
                    value={option.value}
                    checked={typeFilter.includes(option.value)}
                    onChange={handleTypeChange}
                  />
                ))}
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className="mb-3">
                <Form.Label>{translate('Date Range')}</Form.Label>
                <Form.Control
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder={translate('Start Date')}
                  className="mb-2"
                />
                <Form.Control
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder={translate('End Date')}
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className="mb-3">
                <Form.Label>{translate('Tags')}</Form.Label>
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  {getAllTags().map(tag => (
                    <Badge
                      key={tag}
                      bg={selectedTags.includes(tag) ? "primary" : "secondary"}
                      className="me-1 mb-1"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleTagSelect(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                  {getAllTags().length === 0 && (
                    <div className="text-muted">{translate('No tags available')}</div>
                  )}
                </div>
              </Form.Group>
            </Col>
          </Row>
          <div className="d-flex justify-content-end">
            <Button variant="outline-secondary" size="sm" onClick={handleReset}>
              {translate('Reset Filters')}
            </Button>
          </div>
        </Card.Body>
      )}
    </Card>
  );
};

export default EventsFilterPanel; 