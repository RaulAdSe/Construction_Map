import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth services
export const authService = {
  login: async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    
    const response = await apiClient.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
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
    return await apiClient.post('/auth/register', userData);
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

// Project services
export const projectService = {
  getProjects: async () => {
    return await apiClient.get('/projects/');
  },
  
  getProject: async (id) => {
    return await apiClient.get(`/projects/${id}`);
  },
  
  createProject: async (projectData) => {
    return await apiClient.post('/projects/', projectData);
  },
  
  updateProject: async (id, projectData) => {
    return await apiClient.put(`/projects/${id}`, projectData);
  },
  
  deleteProject: async (id) => {
    return await apiClient.delete(`/projects/${id}`);
  },
  
  // Get all project members
  getProjectMembers: async (projectId) => {
    return await apiClient.get(`/projects/${projectId}/members`);
  },
  
  // Add a user to project
  addUserToProject: async (projectId, userId) => {
    return await apiClient.post(`/projects/${projectId}/users`, { 
      user_id: userId
    });
  },
  
  // Update a member's admin status
  updateMemberRole: async (projectId, userId, isAdmin) => {
    return await apiClient.put(`/projects/${projectId}/members/${userId}/role`, {
      role: isAdmin ? "ADMIN" : "MEMBER" 
    });
  },
  
  // Update a member's field in a project
  updateMemberField: async (projectId, userId, field) => {
    return await apiClient.put(`/projects/${projectId}/members/${userId}/field`, { field });
  },
  
  // Remove a user from a project
  removeUserFromProject: async (projectId, userId) => {
    return await apiClient.delete(`/projects/${projectId}/users/${userId}`);
  }
};

// Maps services
export const mapService = {
  getMaps: async () => {
    return await apiClient.get('/maps/');
  },
  
  getMap: async (id) => {
    return await apiClient.get(`/maps/${id}`);
  },
  
  createMap: async (mapData) => {
    const formData = new FormData();
    formData.append('project_id', mapData.project_id);
    formData.append('name', mapData.name);
    formData.append('file', mapData.file);
    
    return await apiClient.post('/maps/', formData, {
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
    
    return await apiClient.put(`/maps/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  deleteMap: async (id) => {
    return await apiClient.delete(`/maps/${id}`);
  }
};

// Events services
export const eventService = {
  getEvents: async () => {
    return await apiClient.get('/events/');
  },
  
  getEvent: async (id) => {
    return await apiClient.get(`/events/${id}`);
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
    
    return await apiClient.post('/events/', formData, {
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
    
    return await apiClient.put(`/events/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  deleteEvent: async (id) => {
    return await apiClient.delete(`/events/${id}`);
  }
};

export default {
  auth: authService,
  projects: projectService,
  maps: mapService,
  events: eventService,
}; 