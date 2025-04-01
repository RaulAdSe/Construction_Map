# Frontend Component Documentation

## Overview

The frontend is built with React and follows a component-based architecture. This document details the key components, their props, state management, and interactions.

## Core Components

### MapViewer (`src/components/MapViewer.js`)

The main component for displaying and interacting with maps.

#### Props
```javascript
{
  projectId: PropTypes.number.isRequired,
  onLogout: PropTypes.func.isRequired
}
```

#### State
```javascript
{
  maps: Array,              // List of available maps
  selectedMap: Object,      // Currently selected map
  events: Array,           // List of events on the map
  visibleMapIds: Array,    // IDs of currently visible maps
  mapVisibilitySettings: Object, // Opacity and visibility settings
  effectiveIsAdmin: Boolean // Current user's effective role
}
```

#### Key Features
- Multiple map layer display
- Dynamic opacity control
- Event placement and management
- Role-based UI adaptation

### EventManager (`src/components/EventManager.js`)

Handles event creation, editing, and management.

#### Props
```javascript
{
  mapId: PropTypes.number.isRequired,
  position: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number
  }),
  onEventAdded: PropTypes.func,
  onEventUpdated: PropTypes.func
}
```

#### Features
- Event creation form
- Position selection
- File attachments
- Status management

### NotificationBell (`src/components/NotificationBell.js`)

Real-time notification display and management.

#### Features
- Unread count badge
- Notification list
- Mark as read functionality
- Click-through navigation

### RoleSwitcher (`src/components/RoleSwitcher.js`)

Allows admins to switch between admin and member views.

#### Props
```javascript
{
  currentIsAdmin: PropTypes.bool,
  onRoleChange: PropTypes.func
}
```

#### Features
- Role toggle button
- Visual role indicator
- Permission context update

## Page Components

### ProjectList (`src/pages/ProjectList.js`)

Main landing page showing all accessible projects.

#### Features
- Project grid display
- Create project modal
- Project search and filtering
- Admin monitoring dashboard access

### MapDetail (`src/pages/MapDetail.js`)

Detailed view of a single map with events.

#### Features
- Map visualization
- Event overlay
- Layer controls
- Comment system

## Utility Components

### FileUploader (`src/components/FileUploader.js`)

Handles file uploads with preview and progress.

#### Props
```javascript
{
  onFileSelected: PropTypes.func.isRequired,
  acceptedTypes: PropTypes.array,
  maxSize: PropTypes.number
}
```

### Modal Components

#### AddEventModal
```javascript
Props: {
  show: Boolean,
  onHide: Function,
  mapId: Number,
  position: Object,
  onEventAdded: Function
}
```

#### ViewEventModal
```javascript
Props: {
  show: Boolean,
  onHide: Function,
  event: Object,
  onEventUpdated: Function,
  userRole: String
}
```

## State Management

### Local State
- Component-specific state using useState
- Complex state with useReducer
- Side effects with useEffect

### Context
- AuthContext: User authentication state
- ProjectContext: Current project data
- NotificationContext: Real-time notifications

## Component Interactions

### Event Flow
1. User clicks on map
2. MapViewer captures coordinates
3. AddEventModal opens
4. EventManager handles creation
5. MapViewer updates display

### Notification Flow
1. WebSocket receives notification
2. NotificationContext updates
3. NotificationBell displays update
4. User interaction triggers actions

## Styling

### CSS Modules
- Component-specific styles
- Scoped class names
- Responsive design

### Bootstrap Integration
- Grid system
- Components
- Utilities

## Performance Considerations

### Optimization Techniques
- React.memo for pure components
- useMemo for expensive calculations
- useCallback for stable callbacks
- Lazy loading for modals

### Data Management
- Cached API responses
- Optimistic updates
- Debounced searches
- Infinite scrolling

## Error Handling

### Error Boundaries
- Component-level error catching
- Fallback UI
- Error reporting

### Form Validation
- Input validation
- Error messages
- Loading states

## Accessibility

### ARIA Attributes
- Role definitions
- State descriptions
- Focus management

### Keyboard Navigation
- Shortcut keys
- Focus trapping
- Tab order

## Testing

### Component Tests
```javascript
describe('MapViewer', () => {
  it('renders map layers correctly', () => {
    // Test implementation
  });
  
  it('handles event placement', () => {
    // Test implementation
  });
});
```

### Integration Tests
- User flows
- API interactions
- State management

## Best Practices

### Component Structure
```javascript
// Template for new components
import React from 'react';
import PropTypes from 'prop-types';
import styles from './ComponentName.module.css';

const ComponentName = ({ prop1, prop2 }) => {
  // State hooks
  
  // Effect hooks
  
  // Event handlers
  
  // Render methods
  
  return (
    <div className={styles.container}>
      {/* Component content */}
    </div>
  );
};

ComponentName.propTypes = {
  prop1: PropTypes.string.isRequired,
  prop2: PropTypes.func
};

export default ComponentName;
```

### Code Organization
- Logical grouping
- Clear naming
- Consistent patterns
- Documentation

## Common Issues and Solutions

### Map Rendering
- PDF scaling issues
- Image caching
- Layer ordering

### Event Handling
- Click detection
- Position calculation
- State updates

### Performance
- Large lists
- Image optimization
- API caching 