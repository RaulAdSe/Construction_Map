import React from 'react';
import { Navigate } from 'react-router-dom';
import { isUserAdmin } from './permissions';

/**
 * AdminRoute component
 * A route wrapper that checks if the user is an admin before rendering
 * If not, redirects to a specified route
 */
export const AdminRoute = ({ children, redirectTo = '/' }) => {
  const isAdmin = isUserAdmin();
  
  if (!isAdmin) {
    return <Navigate to={redirectTo} replace />;
  }
  
  return children;
};

/**
 * PrivateRoute component
 * A route wrapper that checks if the user is authenticated before rendering
 * If not, redirects to the login page
 */
export const PrivateRoute = ({ children, redirectTo = '/' }) => {
  const isAuthenticated = localStorage.getItem('token') !== null;
  
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }
  
  return children;
}; 