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
    
    // DIRECT FIX: Use a fully qualified HTTPS URL instead of relying on axios composition
    const directSecureUrl = `https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/events/`;
    console.log(`[EventService] Using direct secure URL for adding event: ${directSecureUrl}`);
    
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
    
    // Check if eventData is FormData (for multipart/form-data with file upload)
    if (eventData instanceof FormData) {
      // Ensure required fields are present for database compatibility
      const requiredFields = ['project_id', 'map_id', 'name', 'title'];
      for (const field of requiredFields) {
        if (!eventData.has(field)) {
          console.error(`[EventService] Missing required field: ${field}`);
          throw new Error(`Missing required field: ${field}`);
        }
      }
      
      // For FastAPI Form validation, tags needs special handling
      // Looking at backend test cases, it seems to expect a JSON string:
      // "tags": '["test", "issue"]'
      // Rather than trying to modify the FormData here, we ensure it's correctly
      // formatted in the AddEventModal component
      
      // Explicitly log what we're sending
      console.log('[EventService] Sending event data as FormData with fields:');
      for (let pair of eventData.entries()) {
        console.log(pair[0] + ': ' + (pair[0].includes('image') ? '[File data]' : pair[1]));
      }
      
      // Use content-type header for multipart/form-data
      secureConfig.headers['Content-Type'] = 'multipart/form-data';
      response = await api.post(directSecureUrl, eventData, secureConfig);
    } else {
      // For regular JSON data, ensure required fields
      const requiredFields = ['project_id', 'map_id', 'name', 'title'];
      for (const field of requiredFields) {
        if (!eventData[field]) {
          // Set title = name if one exists but the other doesn't
          if (field === 'title' && eventData.name) {
            eventData.title = eventData.name;
          } else if (field === 'name' && eventData.title) {
            eventData.name = eventData.title;
          } else {
            console.error(`[EventService] Missing required field: ${field}`);
            throw new Error(`Missing required field: ${field}`);
          }
        }
      }
      
      // Ensure coordinates exist in both formats
      if (eventData.x_coordinate && !eventData.location_x) {
        eventData.location_x = eventData.x_coordinate;
        eventData.location_y = eventData.y_coordinate;
      } else if (eventData.location_x && !eventData.x_coordinate) {
        eventData.x_coordinate = eventData.location_x;
        eventData.y_coordinate = eventData.location_y;
      }
      
      // FIX: Remove empty tags array
      if (eventData.tags && Array.isArray(eventData.tags) && eventData.tags.length === 0) {
        const { tags, ...dataWithoutEmptyTags } = eventData;
        eventData = dataWithoutEmptyTags;
      }
      
      console.log('[EventService] Sending event data as JSON:', eventData);
      response = await api.post(directSecureUrl, eventData, secureConfig);
    }
    
    console.log('[EventService] Event created successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error adding event:', error);
    throw error;
  }
};

export const updateEvent = async (eventId, eventData) => {
  try {
    // DIRECT FIX: Use fully qualified HTTPS URLs instead of relying on axios composition
    const getUrl = `https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/events/${eventId}`;
    console.log(`[EventService] Using direct secure URL for getting event: ${getUrl}`);
    
    // Create a secure config for the GET request
    const getConfig = {
      url: getUrl,
      baseURL: '', // Remove baseURL to prevent axios from combining it with the URL
      headers: {}
    };
    
    // Add token if available
    const token = localStorage.getItem('token');
    if (token) {
      getConfig.headers.Authorization = `Bearer ${token}`;
    }
    
    // Get current event data to preserve fields not in the update
    const response = await api.get(getUrl, getConfig);
    const currentEvent = { ...response.data };
    
    // Make a copy of the data to avoid mutating the original
    const data = { 
      ...currentEvent,
      ...eventData 
    };
    
    // CRITICAL FIX: Always force active_maps to be a plain object
    // This completely replaces any problematic active_maps data
    data.active_maps = {}; 
    
    // Create the PUT URL and config
    const putUrl = `https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/events/${eventId}`;
    console.log(`[EventService] Using direct secure URL for updating event: ${putUrl}`);
    
    const putConfig = {
      url: putUrl,
      baseURL: '', // Remove baseURL to prevent axios from combining it with the URL
      headers: {}
    };
    
    // Add token to PUT request too
    if (token) {
      putConfig.headers.Authorization = `Bearer ${token}`;
    }
    
    const updateResponse = await api.put(putUrl, data, putConfig);
    return updateResponse.data;
  } catch (error) {
    console.error(`Error updating event ${eventId}:`, error);
    throw error;
  }
};

export const deleteEvent = async (eventId) => {
  try {
    // DIRECT FIX: Use a fully qualified HTTPS URL
    const deleteUrl = `https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/events/${eventId}`;
    console.log(`[EventService] Using direct secure URL for deleting event: ${deleteUrl}`);
    
    // Create a secure config with the direct URL
    const deleteConfig = {
      url: deleteUrl,
      baseURL: '', // Remove baseURL to prevent axios from combining it with the URL
      headers: {}
    };
    
    // Add token if available
    const token = localStorage.getItem('token');
    if (token) {
      deleteConfig.headers.Authorization = `Bearer ${token}`;
    }
    
    const response = await api.delete(deleteUrl, deleteConfig);
    return response.data;
  } catch (error) {
    console.error(`Error deleting event ${eventId}:`, error);
    throw error;
  }
};

export const updateEventStatus = async (eventId, status, userRole) => {
  try {
    // DIRECT FIX: Use a fully qualified HTTPS URL
    const directSecureUrl = `https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/events/${eventId}`;
    console.log(`[EventService] Using direct secure URL for updating event status: ${directSecureUrl}`);
    
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
    
    // Get the current JWT token to check the username
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
    const updateResponse = await api.put(directSecureUrl, {
      status: status,
      is_admin_request: isAdmin
    }, secureConfig);
    
    return updateResponse.data;
  } catch (error) {
    console.error(`Error updating event ${eventId} status:`, error);
    throw error;
  }
};

export const updateEventState = async (eventId, state) => {
  try {
    // DIRECT FIX: Use a fully qualified HTTPS URL
    const directSecureUrl = `https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/events/${eventId}`;
    console.log(`[EventService] Using direct secure URL for updating event state: ${directSecureUrl}`);
    
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
    const updateResponse = await api.put(directSecureUrl, {
      state: state,
      is_admin_request: isAdmin
    }, secureConfig);
    
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
    
    // DIRECT FIX: Use a fully qualified HTTPS URL
    const directSecureUrl = `https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/events/?${params.toString()}`;
    console.log(`[EventService] Using direct secure URL for filtered events: ${directSecureUrl}`);
    
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
    
    // Use the events endpoint with query parameters
    const response = await api.get(directSecureUrl, secureConfig);
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
    
    // DIRECT FIX: Use a fully qualified HTTPS URL
    const directSecureUrl = `https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/events/${eventId}/comments`;
    console.log(`[EventService] Using direct secure URL for fetching comments: ${directSecureUrl}`);
    
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
    
    // Log for debugging
    console.log(`Fetching comments for event ${eventId}`);
    
    // Use the centralized API instance
    const response = await api.get(directSecureUrl, secureConfig);
    
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
    // DIRECT FIX: Use a fully qualified HTTPS URL
    const directSecureUrl = `https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/events/${eventId}/comments`;
    console.log(`[EventService] Using direct secure URL for adding comment: ${directSecureUrl}`);
    
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
    
    // Use the centralized API instance
    const response = await api.post(directSecureUrl, commentData, secureConfig);
    
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
    // DIRECT FIX: Use a fully qualified HTTPS URL
    const directSecureUrl = `https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/events/${eventId}/comments/${commentId}`;
    console.log(`[EventService] Using direct secure URL for updating comment: ${directSecureUrl}`);
    
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
    
    // Use the centralized API instance with PUT method
    const response = await api.put(directSecureUrl, updateData, secureConfig);
    
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
    // DIRECT FIX: Use a fully qualified HTTPS URL
    const directSecureUrl = `https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/events/${eventId}/comments/${commentId}`;
    console.log(`[EventService] Using direct secure URL for deleting comment: ${directSecureUrl}`);
    
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
    
    // Use the centralized API instance with DELETE method
    const response = await api.delete(directSecureUrl, secureConfig);
    
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