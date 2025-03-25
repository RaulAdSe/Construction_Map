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

export const updateEventStatus = async (eventId, status) => {
  try {
    // First get the current event to preserve its data
    const response = await api.get(`${API_URL}/events/${eventId}`);
    const currentEvent = { ...response.data };
    
    // CRITICAL FIX: Always force active_maps to be a plain object
    // This completely replaces any problematic active_maps data
    currentEvent.active_maps = {}; 
    
    // Prepare data with status update
    const data = { 
      ...currentEvent,
      status 
    };
    
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
    const currentEvent = { ...response.data };
    
    // CRITICAL FIX: Always force active_maps to be a plain object
    // This completely replaces any problematic active_maps data
    currentEvent.active_maps = {}; 
    
    // Prepare data with state update
    const data = { 
      ...currentEvent,
      state 
    };
    
    const updateResponse = await api.put(`${API_URL}/events/${eventId}`, data);
    return updateResponse.data;
  } catch (error) {
    console.error(`Error updating event ${eventId} state:`, error);
    throw error;
  }
}; 