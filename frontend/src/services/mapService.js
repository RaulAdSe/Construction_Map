import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1';

// Create instance with auth header
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Create api instance with default headers
const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Add auth header to each request
api.interceptors.request.use(config => {
  const headers = getAuthHeader();
  config.headers = {
    ...config.headers,
    ...headers
  };
  return config;
});

export const fetchProjects = async () => {
  try {
    const response = await api.get(`${API_URL}/projects`);
    return response.data;
  } catch (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }
};

export const createProject = async (projectData) => {
  try {
    const response = await api.post(`${API_URL}/projects`, projectData);
    return response.data;
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
};

export const deleteProject = async (projectId) => {
  try {
    const response = await api.delete(`${API_URL}/projects/${projectId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting project ${projectId}:`, error);
    throw error;
  }
};

export const fetchProjectById = async (projectId) => {
  try {
    const response = await api.get(`${API_URL}/projects/${projectId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching project ${projectId}:`, error);
    throw error;
  }
};

export const fetchMaps = async (projectId) => {
  try {
    console.log(`Fetching maps for project ${projectId}`);
    const response = await api.get(`${API_URL}/maps?project_id=${projectId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching maps for project ${projectId}:`, error);
    throw error;
  }
};

export const addMap = async (projectId, name, file, mapType = 'implantation') => {
  try {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('file', file);
    formData.append('project_id', projectId);
    formData.append('map_type', mapType);
    
    const response = await axios.post(`${API_URL}/maps`, formData, {
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error adding map:', error);
    throw error;
  }
};

export const getMapById = async (mapId) => {
  try {
    const response = await api.get(`${API_URL}/maps/${mapId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching map ${mapId}:`, error);
    throw error;
  }
};

export const deleteMap = async (mapId) => {
  try {
    const response = await api.delete(`${API_URL}/maps/${mapId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting map ${mapId}:`, error);
    throw error;
  }
};

export const updateMap = async (mapId, data) => {
  try {
    const response = await api.put(`${API_URL}/maps/${mapId}`, data);
    return response.data;
  } catch (error) {
    console.error(`Error updating map ${mapId}:`, error);
    throw error;
  }
}; 