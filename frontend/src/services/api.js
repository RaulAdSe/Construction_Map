import axios from 'axios';
import { API_URL } from '../config'; // Import from central config

// Add debug flag to control console output
const DEBUG = true; // Temporarily enable debugging

// Create an axios instance with default settings
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add auth token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  if (DEBUG) console.error('Request error:', error);
  return Promise.reject(error);
});

// Add response interceptor to handle common responses
api.interceptors.response.use(
  response => {
    return response;
  },
  error => {
    // Handle unauthorized errors (401)
    if (error.response && error.response.status === 401) {
      if (DEBUG) console.warn('Unauthorized access, redirecting to login');
      // Check if we're not already on the login page to avoid redirect loops
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    
    // Log other errors only when debugging is enabled
    if (DEBUG) {
      if (error.response) {
        console.error('Response error:', error.response.status, error.response.data);
      } else if (error.request) {
        console.error('Request error (no response):', error.request);
      } else {
        console.error('Error setting up request:', error.message);
      }
    }
    
    return Promise.reject(error);
  }
);

// Export the api instance
export default api;

// Auth services
export const authService = {
  login: async (username, password) => {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    params.append('grant_type', 'password');
    
    const response = await api.post('/auth/login', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
      
      // Store user info
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      
      return response.data;
    }
    return null;
  },
  
  register: async (userData) => {
    return await api.post('/auth/register', userData);
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

// Project services
export const projectService = {
  getProjects: async () => {
    return await api.get('/projects/');
  },
  
  getProject: async (id) => {
    return await api.get(`/projects/${id}`);
  },
  
  createProject: async (projectData) => {
    return await api.post('/projects/', projectData);
  },
  
  updateProject: async (id, projectData) => {
    return await api.put(`/projects/${id}`, projectData);
  },
  
  deleteProject: async (id) => {
    return await api.delete(`/projects/${id}`);
  },
  
  // Get all project tags
  getProjectTags: async (projectId) => {
    return await api.get(`/projects/${projectId}/tags`);
  },
  
  // Get all project members
  getProjectMembers: async (projectId) => {
    return await api.get(`/projects/${projectId}/members`);
  },
  
  // Add a user to project
  addUserToProject: async (projectId, userId) => {
    return await api.post(`/projects/${projectId}/users`, { 
      user_id: userId
    });
  },
  
  // Update a member's admin status
  updateMemberRole: async (projectId, userId, isAdmin) => {
    return await api.put(`/projects/${projectId}/members/${userId}/role`, {
      role: isAdmin ? "ADMIN" : "MEMBER" 
    });
  },
  
  // Update a member's field in a project
  updateMemberField: async (projectId, userId, field) => {
    console.log(`API call: updateMemberField for project ${projectId}, user ${userId}, field "${field}"`);
    try {
      // Ensure field is a string
      const fieldValue = String(field).trim();
      console.log(`Sending field update with value: "${fieldValue}"`);
      
      const response = await api.put(`/projects/${projectId}/users/${userId}/field`, 
        { field: fieldValue },
        { 
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Field update API response:', response);
      return response.data;
    } catch (error) {
      console.error('Field update API error:', error);
      throw error;
    }
  },
  
  // Remove a user from a project
  removeUserFromProject: async (projectId, userId) => {
    return await api.delete(`/projects/${projectId}/users/${userId}`);
  }
};

// Maps services
export const mapService = {
  getMaps: async () => {
    return await api.get('/maps/');
  },
  
  getMap: async (id) => {
    return await api.get(`/maps/${id}`);
  },
  
  createMap: async (mapData) => {
    const formData = new FormData();
    formData.append('project_id', mapData.project_id);
    formData.append('name', mapData.name);
    formData.append('file', mapData.file);
    
    return await api.post('/maps/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  updateMap: async (id, mapData) => {
    const formData = new FormData();
    formData.append('name', mapData.name);
    
    if (mapData.file) {
      formData.append('file', mapData.file);
    }
    
    return await api.put(`/maps/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  deleteMap: async (id) => {
    return await api.delete(`/maps/${id}`);
  }
};

// Events services
export const eventService = {
  getEvents: async () => {
    return await api.get('/events/');
  },
  
  getEvent: async (id) => {
    return await api.get(`/events/${id}`);
  },
  
  createEvent: async (eventData) => {
    const formData = new FormData();
    formData.append('map_id', eventData.map_id);
    formData.append('title', eventData.title);
    formData.append('description', eventData.description);
    formData.append('x_coordinate', eventData.x_coordinate);
    formData.append('y_coordinate', eventData.y_coordinate);
    formData.append('status', eventData.status || 'open');
    
    if (eventData.image) {
      formData.append('image', eventData.image);
    }
    
    return await api.post('/events/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  updateEvent: async (id, eventData) => {
    const formData = new FormData();
    
    if (eventData.title) formData.append('title', eventData.title);
    if (eventData.description) formData.append('description', eventData.description);
    if (eventData.status) formData.append('status', eventData.status);
    if (eventData.image) formData.append('image', eventData.image);
    
    return await api.put(`/events/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  deleteEvent: async (id) => {
    return await api.delete(`/events/${id}`);
  }
}; 