import axios from 'axios';
import { API_URL, ensureHttps } from '../config';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Add request interceptor to include auth token and force HTTPS
apiClient.interceptors.request.use(config => {
  // Add authorization header
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Ensure URL uses HTTPS for all absolute URLs
  if (config.url) {
    // If it's an absolute URL (contains ://)
    if (config.url.includes('://')) {
      config.url = config.url.replace(/^http:\/\//i, 'https://');
    }
  }
  
  // Also ensure baseURL uses HTTPS
  if (config.baseURL && config.baseURL.includes('://')) {
    config.baseURL = config.baseURL.replace(/^http:\/\//i, 'https://');
  }
  
  return config;
});

// Get all users (admin only)
export const getAllUsers = async () => {
  try {
    const response = await apiClient.get('/users');
    return response.data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

// Get a specific user by ID
export const getUserById = async (userId) => {
  try {
    const response = await apiClient.get(`/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching user ${userId}:`, error);
    throw error;
  }
}; 