import axios from 'axios';
import { API_URL, API_PATH, ensureHttps } from '../config';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: ensureHttps(API_URL + API_PATH),
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
    // Force HTTPS for this particular request
    const secureUrl = 'https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/users';
    const response = await axios.get(secureUrl, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
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