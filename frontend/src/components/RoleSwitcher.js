import React, { useState, useEffect } from 'react';
import { Form, Button, Badge } from 'react-bootstrap';

/**
 * Component to allow admin users to temporarily switch their view between ADMIN and MEMBER
 * This is useful for testing functionality with different permission levels
 */
const RoleSwitcher = ({ 
  currentRole,
  onRoleChange,
  isAdminUser = false 
}) => {
  const [viewAs, setViewAs] = useState(currentRole || 'ADMIN');
  
  // Update internal state when prop changes
  useEffect(() => {
    if (currentRole) {
      setViewAs(currentRole);
    }
  }, [currentRole]);
  
  // Only render if user is an admin
  if (!isAdminUser) {
    return null;
  }
  
  const handleRoleToggle = () => {
    const newRole = viewAs === 'ADMIN' ? 'MEMBER' : 'ADMIN';
    setViewAs(newRole);
    if (onRoleChange) {
      onRoleChange(newRole);
    }
  };
  
  return (
    <div className="role-switcher d-flex align-items-center">
      <small className="text-muted me-2">View as:</small>
      <Button 
        size="sm" 
        variant={viewAs === 'ADMIN' ? 'primary' : 'secondary'}
        onClick={handleRoleToggle}
        className="d-flex align-items-center"
      >
        <Badge bg={viewAs === 'ADMIN' ? 'light' : 'dark'} text={viewAs === 'ADMIN' ? 'dark' : 'light'} className="me-1">
          {viewAs}
        </Badge>
        <small>{viewAs === 'ADMIN' ? '→ Switch to Member' : '→ Switch to Admin'}</small>
      </Button>
    </div>
  );
};

export default RoleSwitcher; 