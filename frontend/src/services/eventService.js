import axios from 'axios';

const API_URL = 'https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1';

// Create API instance with default config
const api = axios.create({
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

// Add auth header to each request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add debug flag to control console output
const DEBUG = false;

export const fetchEvents = async (mapId) => {
  try {
    const response = await api.get(`${API_URL}/maps/${mapId}/events`);
    
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
    console.error('Error fetching events:', error);
    throw error;
  }
};

// Helper function to get detailed event information including username
export const getEventDetails = async (eventId) => {
  try {
    const response = await api.get(`${API_URL}/events/${eventId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching event details for event ${eventId}:`, error);
    throw error;
  }
};

export const addEvent = async (eventData) => {
  try {
    let response;
    
    // Check if eventData is FormData (for multipart/form-data with file upload)
    if (eventData instanceof FormData) {
      // Get token for authorization header
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      // FormData requires different content type header
      response = await axios.post(`${API_URL}/events`, eventData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data'
        }
      });
    } else {
      // Regular JSON data
      response = await api.post(`${API_URL}/events`, eventData);
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
    const response = await api.get(`${API_URL}/events/${eventId}`);
    const currentEvent = { ...response.data };
    
    // Make a copy of the data to avoid mutating the original
    const data = { 
      ...currentEvent,
      ...eventData 
    };
    
    // CRITICAL FIX: Always force active_maps to be a plain object
    // This completely replaces any problematic active_maps data
    data.active_maps = {}; 
    
    const updateResponse = await api.put(`${API_URL}/events/${eventId}`, data);
    return updateResponse.data;
  } catch (error) {
    console.error(`Error updating event ${eventId}:`, error);
    throw error;
  }
};

export const deleteEvent = async (eventId) => {
  try {
    const response = await api.delete(`${API_URL}/events/${eventId}`);
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
    const updateResponse = await api.put(`${API_URL}/events/${eventId}`, {
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
    const updateResponse = await api.put(`${API_URL}/events/${eventId}`, {
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
    
    const response = await api.get(`${API_URL}/events/?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching filtered events:', error);
    throw error;
  }
}; 