import { ensureHttps } from '../config';
import api from '../api'; // Import the centralized API instance

// Add debug flag to control console output
const DEBUG = false;

export const fetchEvents = async (projectId) => {
  try {
    if (!projectId) {
      console.error('Missing project ID in fetchEvents call');
      return [];
    }
    
    console.debug(`[EventService Debug] Fetching events for project ${projectId}`);
    
    // DIRECT FIX: Use a fully qualified HTTPS URL instead of relying on axios composition
    const directSecureUrl = `https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/events/?project_id=${encodeURIComponent(projectId)}`;
    console.log(`[EventService] Using direct secure URL: ${directSecureUrl}`);
    
    // Create a secure config with the direct URL
    const secureConfig = {
      url: directSecureUrl,
      baseURL: '', // Remove baseURL to prevent axios from combining it with the URL
      headers: {}
    };
    
    // Add token if available
    const token = localStorage.getItem('token');
    if (token) {
      secureConfig.headers.Authorization = `Bearer ${token}`;
    }
    
    const response = await api.get(directSecureUrl, secureConfig);
    
    console.log(`[EventService] Successfully fetched ${response.data?.length || 0} events for project ${projectId}`);
    
    // Ensure each event has a created_by_user_name
    const eventsWithUserNames = response.data.map(event => {
      if (!event.created_by_user_name) {
        // Make a request to get detailed event information with username
        return getEventDetails(event.id)
          .then(detailedEvent => {
            // Return the event with username from detailed version
            return {
              ...event,
              created_by_user_name: detailedEvent.created_by_user_name
            };
          })
          .catch(() => {
            // If the request fails, keep the original event
            return event;
          });
      }
      return Promise.resolve(event);
    });
    
    // Wait for all events to be processed
    return Promise.all(eventsWithUserNames);
  } catch (error) {
    console.error(`Error fetching events for project ${projectId}:`, error);
    
    // If unauthorized, redirect to login
    if (error.response && error.response.status === 401) {
      console.warn('[EventService] Token expired. Redirecting to login...');
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }
    
    return [];
  }
};

/**
 * Fetch all events for a specific map
 * @param {string|number} mapId - ID of the map to fetch events for
 * @returns {Promise<Array>} - Promise resolving to an array of event objects
 */
export const fetchMapEvents = async (mapId) => {
  try {
    if (!mapId) {
      console.error('Missing map ID in fetchMapEvents call');
      return [];
    }
    
    console.debug(`[EventService Debug] Fetching events for map ${mapId}`);
    
    // DIRECT FIX: Use a fully qualified HTTPS URL instead of relying on axios composition
    const directSecureUrl = `https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/maps/${mapId}/events/`;
    console.log(`[EventService] Using direct secure URL: ${directSecureUrl}`);
    
    // Create a secure config with the direct URL
    const secureConfig = {
      url: directSecureUrl,
      baseURL: '', // Remove baseURL to prevent axios from combining it with the URL
      headers: {}
    };
    
    // Add token if available
    const token = localStorage.getItem('token');
    if (token) {
      secureConfig.headers.Authorization = `Bearer ${token}`;
    }
    
    // Use the direct secure URL
    const response = await api.get(directSecureUrl, secureConfig);
    
    console.log(`[EventService] Successfully fetched ${response.data?.length || 0} events for map ${mapId}`);
    
    // Ensure each event has a created_by_user_name
    const eventsWithUserNames = response.data.map(event => {
      if (!event.created_by_user_name) {
        // Make a request to get detailed event information with username
        return getEventDetails(event.id)
          .then(detailedEvent => {
            // Return the event with username from detailed version
            return {
              ...event,
              created_by_user_name: detailedEvent.created_by_user_name
            };
          })
          .catch(() => {
            // If the request fails, keep the original event
            return event;
          });
      }
      return Promise.resolve(event);
    });
    
    // Wait for all events to be processed
    return Promise.all(eventsWithUserNames);
  } catch (error) {
    console.error(`[EventService Error] Failed to fetch events for map ${mapId}:`, error);
    
    // If unauthorized, redirect to login
    if (error.response && error.response.status === 401) {
      console.warn('[EventService] Token expired. Redirecting to login...');
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }
    
    return []; // Return empty array on error instead of throwing
  }
};

// Helper function to get detailed event information including username
export const getEventDetails = async (eventId) => {
  try {
    console.debug(`[EventService Debug] Fetching event details for ${eventId}`);
    
    // DIRECT FIX: Use a fully qualified HTTPS URL
    const directSecureUrl = `https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/events/${eventId}`;
    console.log(`[EventService] Using direct secure URL: ${directSecureUrl}`);
    
    // Create a secure config with the direct URL
    const secureConfig = {
      url: directSecureUrl,
      baseURL: '', // Remove baseURL to prevent axios from combining it with the URL
      headers: {}
    };
    
    // Add token if available
    const token = localStorage.getItem('token');
    if (token) {
      secureConfig.headers.Authorization = `Bearer ${token}`;
    }
    
    // Use the direct secure URL
    const response = await api.get(directSecureUrl, secureConfig);
    
    return response.data;
  } catch (error) {
    console.error(`[EventService Error] Failed to fetch event details for event ${eventId}:`, error);
    throw error;
  }
};

export const addEvent = async (eventData) => {
  try {
    let response;
    
    // Check if eventData is FormData (for multipart/form-data with file upload)
    if (eventData instanceof FormData) {
      // Use the central API instance but with content-type header for this request
      response = await api.post('events', eventData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
    } else {
      // Regular JSON data - use the api instance
      response = await api.post('events', eventData);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error adding event:', error);
    throw error;
  }
};

export const updateEvent = async (eventId, eventData) => {
  try {
    // Get current event data to preserve fields not in the update
    const response = await api.get(`events/${eventId}`);
    const currentEvent = { ...response.data };
    
    // Make a copy of the data to avoid mutating the original
    const data = { 
      ...currentEvent,
      ...eventData 
    };
    
    // CRITICAL FIX: Always force active_maps to be a plain object
    // This completely replaces any problematic active_maps data
    data.active_maps = {}; 
    
    const updateResponse = await api.put(`events/${eventId}`, data);
    return updateResponse.data;
  } catch (error) {
    console.error(`Error updating event ${eventId}:`, error);
    throw error;
  }
};

export const deleteEvent = async (eventId) => {
  try {
    const response = await api.delete(`events/${eventId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting event ${eventId}:`, error);
    throw error;
  }
};

export const updateEventStatus = async (eventId, status, userRole) => {
  try {
    // Get the current JWT token to check the username
    const token = localStorage.getItem('token');
    let isAdmin = false;
    
    // First check if we have a user object in localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user.is_admin === true) {
          isAdmin = true;
          if (DEBUG) console.log('eventService: User is admin from localStorage');
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    } 
    // Next check if userRole was passed
    else if (userRole) {
      isAdmin = userRole === 'ADMIN';
    } 
    // Last resort, parse the token payload
    else if (token) {
      try {
        // Parse the token payload as fallback
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Check if the user is admin
        isAdmin = payload.sub === 'admin'; // In our simplified authentication
      } catch (error) {
        console.error('Error parsing token:', error);
      }
    }
    
    // Extra safety check - non-admins cannot close events
    if (status === 'closed' && !isAdmin) {
      throw new Error('Only ADMIN users can close events');
    }
    
    if (DEBUG) console.log(`Updating event ${eventId} status to ${status}`);
    
    // Match the expected format for EventUpdate
    const updateResponse = await api.put(`events/${eventId}`, {
      status: status,
      is_admin_request: isAdmin
    });
    
    return updateResponse.data;
  } catch (error) {
    console.error(`Error updating event ${eventId} status:`, error);
    throw error;
  }
};

export const updateEventState = async (eventId, state) => {
  try {
    if (DEBUG) console.log(`Updating event ${eventId} state to ${state}`);
    
    // Get admin status
    let isAdmin = false;
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user.is_admin === true) {
          isAdmin = true;
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
    
    // Match the expected format for EventUpdate
    const updateResponse = await api.put(`events/${eventId}`, {
      state: state,
      is_admin_request: isAdmin
    });
    
    return updateResponse.data;
  } catch (error) {
    console.error(`Error updating event ${eventId} state:`, error);
    throw error;
  }
};

/**
 * Get events with optional filters
 * @param {Object} options - Filter options
 * @param {number} options.projectId - Project ID
 * @param {number} [options.userId] - Filter by user ID
 * @param {string[]} [options.status] - Filter by status values
 * @param {string[]} [options.type] - Filter by type/state values
 * @param {string} [options.startDate] - Filter by start date (YYYY-MM-DD)
 * @param {string} [options.endDate] - Filter by end date (YYYY-MM-DD)
 * @param {string[]} [options.tags] - Filter by tags
 * @param {number} [options.skip=0] - Number of records to skip
 * @param {number} [options.limit=100] - Maximum number of records to return
 * @returns {Promise<Array>} - List of events
 */
export const getFilteredEvents = async (options) => {
  try {
    const {
      projectId,
      userId,
      status,
      type,
      startDate,
      endDate,
      tags,
      skip = 0,
      limit = 100
    } = options;

    // Build query parameters
    const params = new URLSearchParams();
    params.append('project_id', projectId);
    
    if (userId) params.append('user_id', userId);
    if (skip) params.append('skip', skip);
    if (limit) params.append('limit', limit);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    // Add array parameters
    if (status && status.length > 0) {
      status.forEach(s => params.append('status', s));
    }
    
    if (type && type.length > 0) {
      type.forEach(t => params.append('type', t));
    }
    
    if (tags && tags.length > 0) {
      tags.forEach(tag => params.append('tags', tag));
    }
    
    // Use the events endpoint with query parameters
    const response = await api.get(`events?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching filtered events:', error);
    throw error;
  }
};

export const fetchEventComments = async (eventId) => {
  try {
    if (!eventId) {
      console.error('Missing event ID in fetchEventComments call');
      return [];
    }
    
    // Use the correct endpoint pattern for event comments as per the API docs
    const url = `events/${eventId}/comments`;
    
    // Log for debugging
    console.log(`Fetching comments for event ${eventId}`);
    
    // Use the centralized API instance
    const response = await api.get(url);
    
    return response.data;
  } catch (error) {
    console.error(`Error fetching comments for event ${eventId}:`, error);
    return []; // Return empty array on error
  }
};

/**
 * Add a comment to an event
 * @param {string|number} eventId - ID of the event to add comment to
 * @param {Object} commentData - Comment data
 * @returns {Promise<Object>} - Promise resolving to the created comment
 */
export const addEventComment = async (eventId, commentData) => {
  try {
    // Use the correct endpoint pattern for adding event comments
    const url = `events/${eventId}/comments`;
    
    // Use the centralized API instance
    const response = await api.post(url, commentData);
    
    return response.data;
  } catch (error) {
    console.error(`Error adding comment to event ${eventId}:`, error);
    throw error;
  }
};

/**
 * Update an existing comment
 * @param {string|number} eventId - ID of the event the comment belongs to
 * @param {string|number} commentId - ID of the comment to update
 * @param {Object} updateData - New comment data
 * @returns {Promise<Object>} - Promise resolving to the updated comment
 */
export const updateEventComment = async (eventId, commentId, updateData) => {
  try {
    // Use the correct endpoint pattern for updating event comments
    const url = `events/${eventId}/comments/${commentId}`;
    
    // Use the centralized API instance with PUT method
    const response = await api.put(url, updateData);
    
    return response.data;
  } catch (error) {
    console.error(`Error updating comment ${commentId} for event ${eventId}:`, error);
    throw error;
  }
};

/**
 * Delete a comment
 * @param {string|number} eventId - ID of the event the comment belongs to
 * @param {string|number} commentId - ID of the comment to delete
 * @returns {Promise<Object>} - Promise resolving to the deletion result
 */
export const deleteEventComment = async (eventId, commentId) => {
  try {
    // Use the correct endpoint pattern for deleting event comments
    const url = `events/${eventId}/comments/${commentId}`;
    
    // Use the centralized API instance with DELETE method
    const response = await api.delete(url);
    
    return response.data;
  } catch (error) {
    console.error(`Error deleting comment ${commentId} for event ${eventId}:`, error);
    throw error;
  }
};

/**
 * Fetch events for a specific project
 * @param {string|number} projectId - ID of the project to fetch events for
 * @returns {Promise<Array>} - Promise resolving to array of events
 */
export const fetchProjectEvents = async (projectId) => {
  try {
    console.debug(`[EventService Debug] Fetching events for project ${projectId}`);
    
    // DIRECT FIX: Use a fully qualified HTTPS URL instead of relying on axios composition
    const directSecureUrl = `https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/events/?project_id=${encodeURIComponent(projectId)}`;
    console.log(`[EventService] Using direct secure URL: ${directSecureUrl}`);
    
    // Create a secure config with the direct URL
    const secureConfig = {
      url: directSecureUrl,
      baseURL: '', // Remove baseURL to prevent axios from combining it with the URL
      headers: {}
    };
    
    // Add token if available
    const token = localStorage.getItem('token');
    if (token) {
      secureConfig.headers.Authorization = `Bearer ${token}`;
    }
    
    const response = await api.get(directSecureUrl, secureConfig);
    
    console.log(`[EventService] Successfully fetched ${response.data?.length || 0} events for project ${projectId}`);
    return response.data;
  } catch (error) {
    console.error(`[EventService Error] Failed to fetch events for project ${projectId}:`, error);
    
    // If unauthorized, redirect to login
    if (error.response && error.response.status === 401) {
      console.warn('[EventService] Token expired. Redirecting to login...');
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }
    
    return [];
  }
}; 