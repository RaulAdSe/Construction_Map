/**
 * Centralized permission utilities
 * This file contains helper functions for checking user permissions
 */

/**
 * Check if a user has admin privileges
 * @param {boolean} effectiveIsAdmin - Boolean indicating if the user should be treated as admin
 * @returns {boolean} - True if the user is an admin
 */
export const isUserAdmin = (effectiveIsAdmin = null) => {
  // Prioritize effectiveIsAdmin when provided (used for role switching)
  if (effectiveIsAdmin !== null) {
    return effectiveIsAdmin === true;
  }
  
  // Then check stored user data only if effectiveIsAdmin is not provided
  try {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (storedUser && storedUser.is_admin === true) {
      return true;
    }
  } catch (error) {
    console.error('Error checking admin status:', error);
  }
  
  // As a last resort, check the token
  try {
    const token = localStorage.getItem('token');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.sub === 'admin') {  // Legacy check
        return true;
      }
    }
  } catch (error) {
    console.error('Error parsing token:', error);
  }
  
  return false;
};

/**
 * Check if a user can perform an action that requires admin privileges
 * @param {string} action - The action being attempted (for logging)
 * @param {boolean} effectiveIsAdmin - Boolean indicating if the user should be treated as admin
 * @returns {boolean} - True if the action is allowed
 */
export const canPerformAdminAction = (action, effectiveIsAdmin = null) => {
  const isAdmin = isUserAdmin(effectiveIsAdmin);
  
  if (!isAdmin) {
    console.warn(`Permission denied: User attempted admin action: ${action}`);
  }
  
  return isAdmin;
}; 