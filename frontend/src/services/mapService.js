import { apiClient } from './api';

export const fetchProjects = async () => {
  try {
    const response = await apiClient.get(`/projects`);
    return response.data;
  } catch (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }
};

export const createProject = async (projectData) => {
  try {
    const response = await apiClient.post(`/projects`, projectData);
    return response.data;
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
};

export const deleteProject = async (projectId) => {
  try {
    const response = await apiClient.delete(`/projects/${projectId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting project ${projectId}:`, error);
    throw error;
  }
};

export const fetchProjectById = async (projectId) => {
  try {
    const response = await apiClient.get(`/projects/${projectId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching project ${projectId}:`, error);
    throw error;
  }
};

export const fetchMaps = async (projectId) => {
  try {
    console.log(`Fetching maps for project ${projectId}`);
    const response = await apiClient.get(`/maps?project_id=${projectId}`);
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
    
    const response = await apiClient.post(`/maps`, formData, {
      headers: {
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
    const response = await apiClient.get(`/maps/${mapId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching map ${mapId}:`, error);
    throw error;
  }
};

export const deleteMap = async (mapId) => {
  try {
    const response = await apiClient.delete(`/maps/${mapId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting map ${mapId}:`, error);
    throw error;
  }
};

export const updateMap = async (mapId, data) => {
  try {
    const response = await apiClient.put(`/maps/${mapId}`, data);
    return response.data;
  } catch (error) {
    console.error(`Error updating map ${mapId}:`, error);
    throw error;
  }
}; 