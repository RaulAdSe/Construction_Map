import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

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

export const fetchEvents = async (mapId) => {
  try {
    const response = await api.get(`${API_URL}/maps/${mapId}/events`);
    return response.data;
  } catch (error) {
    console.error('Error fetching events:', error);
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
    // Make a copy of the data to avoid mutating the original
    const data = { ...eventData };
    
    // Ensure active_maps is a valid object if it exists
    if (data.active_maps) {
      // If it's a string, try to parse it
      if (typeof data.active_maps === 'string') {
        try {
          data.active_maps = JSON.parse(data.active_maps);
        } catch (e) {
          console.warn('Failed to parse active_maps string, setting to empty object');
          data.active_maps = {};
        }
      }
      
      // If it's an array, convert to object
      if (Array.isArray(data.active_maps)) {
        console.warn('active_maps is an array, converting to empty object');
        data.active_maps = {};
      }
    }
    
    const response = await api.put(`${API_URL}/events/${eventId}`, data);
    return response.data;
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

export const updateEventStatus = async (eventId, status) => {
  try {
    // First get the current event to preserve its data
    const response = await api.get(`${API_URL}/events/${eventId}`);
    const currentEvent = response.data;
    
    // Prepare data with properly formatted active_maps
    const data = { 
      ...currentEvent,
      status 
    };
    
    // Handle active_maps as in updateEvent
    if (data.active_maps) {
      if (typeof data.active_maps === 'string') {
        try {
          data.active_maps = JSON.parse(data.active_maps);
        } catch (e) {
          console.warn('Failed to parse active_maps string, setting to empty object');
          data.active_maps = {};
        }
      }
      
      // Handle both empty array and populated array cases
      if (Array.isArray(data.active_maps)) {
        console.warn('active_maps is an array, converting to empty object');
        data.active_maps = {};
      }
    } else {
      // Ensure we always have an object, not undefined
      data.active_maps = {};
    }
    
    const updateResponse = await api.put(`${API_URL}/events/${eventId}`, data);
    return updateResponse.data;
  } catch (error) {
    console.error(`Error updating event ${eventId} status:`, error);
    throw error;
  }
};

export const updateEventState = async (eventId, state) => {
  try {
    // First get the current event to preserve its data
    const response = await api.get(`${API_URL}/events/${eventId}`);
    const currentEvent = response.data;
    
    // Prepare data with properly formatted active_maps
    const data = { 
      ...currentEvent,
      state 
    };
    
    // Handle active_maps as in updateEvent
    if (data.active_maps) {
      if (typeof data.active_maps === 'string') {
        try {
          data.active_maps = JSON.parse(data.active_maps);
        } catch (e) {
          console.warn('Failed to parse active_maps string, setting to empty object');
          data.active_maps = {};
        }
      }
      
      // Handle both empty array and populated array cases
      if (Array.isArray(data.active_maps)) {
        console.warn('active_maps is an array, converting to empty object');
        data.active_maps = {};
      }
    } else {
      // Ensure we always have an object, not undefined
      data.active_maps = {};
    }
    
    const updateResponse = await api.put(`${API_URL}/events/${eventId}`, data);
    return updateResponse.data;
  } catch (error) {
    console.error(`Error updating event ${eventId} state:`, error);
    throw error;
  }
}; 