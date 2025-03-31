import React, { useState, useEffect } from 'react';
import { Button, Badge } from 'react-bootstrap';
import { isUserAdmin } from '../utils/permissions';

/**
 * Component to allow admin users to temporarily switch their view between ADMIN and MEMBER
 * This is useful for testing functionality with different permission levels
 */
const RoleSwitcher = ({ 
  currentRole,
  onRoleChange
}) => {
  const [viewAs, setViewAs] = useState(currentRole || 'ADMIN');
  
  // Update internal state when prop changes
  useEffect(() => {
    if (currentRole) {
      setViewAs(currentRole);
    }
  }, [currentRole]);
  
  // Get the actual admin status from localStorage, not the effective role
  // This ensures the switcher always appears for true admins even when in MEMBER view
  const isActualAdmin = () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      return storedUser && storedUser.is_admin === true;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  };
  
  // Only render if user is actually an admin
  if (!isActualAdmin()) {
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