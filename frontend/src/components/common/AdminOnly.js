import React from 'react';
import { Alert } from 'react-bootstrap';
import { isUserAdmin } from '../../utils/permissions';

/**
 * A wrapper component that only renders its children if the current user is an admin
 * Otherwise, displays an access denied message
 */
const AdminOnly = ({ children, message = 'You need administrator privileges to access this content.' }) => {
  const isAdmin = isUserAdmin();
  
  if (!isAdmin) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Access Denied</Alert.Heading>
        <p>{message}</p>
      </Alert>
    );
  }
  
  return <>{children}</>;
};

export default AdminOnly; 