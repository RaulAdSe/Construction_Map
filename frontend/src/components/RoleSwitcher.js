import React, { useState, useEffect } from 'react';
import { Button, Badge } from 'react-bootstrap';
import { isUserAdmin } from '../utils/permissions';

/**
 * Component to allow admin users to temporarily switch their view between admin and member roles
 * This is useful for testing functionality with different permission levels
 */
const RoleSwitcher = ({ 
  currentIsAdmin,
  onRoleChange
}) => {
  const [viewAsAdmin, setViewAsAdmin] = useState(currentIsAdmin !== false);
  
  // Update internal state when prop changes
  useEffect(() => {
    if (currentIsAdmin !== undefined) {
      setViewAsAdmin(currentIsAdmin);
    }
  }, [currentIsAdmin]);
  
  // Get the actual admin status from localStorage, not the effective role
  // This ensures the switcher always appears for true admins even when in member view
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
    const newIsAdmin = !viewAsAdmin;
    setViewAsAdmin(newIsAdmin);
    if (onRoleChange) {
      onRoleChange(newIsAdmin);
    }
  };
  
  return (
    <div className="role-switcher d-flex align-items-center me-3">
      <small className="text-muted me-2">View as:</small>
      <Button 
        size="sm" 
        variant={viewAsAdmin ? 'primary' : 'secondary'}
        onClick={handleRoleToggle}
        className="d-flex align-items-center"
      >
        <Badge bg={viewAsAdmin ? 'light' : 'dark'} text={viewAsAdmin ? 'dark' : 'light'} className="me-1">
          {viewAsAdmin ? 'ADMIN' : 'MEMBER'}
        </Badge>
        <small>{viewAsAdmin ? '→ Switch to Member' : '→ Switch to Admin'}</small>
      </Button>
    </div>
  );
};

export default RoleSwitcher; 