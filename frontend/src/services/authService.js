import axios from 'axios';
import { apiClient } from './api';

// Always use cloud URL to avoid localhost references in production
const API_URL = 'https://construction-map-backend-ypzdt6srya-uc.a.run.app/api/v1/auth';

// Create instance with default config
const api = axios.create({
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

export const login = async (username, password) => {
  try {
    console.log('Attempting login with API URL:', API_URL);
    // Use URLSearchParams for proper x-www-form-urlencoded format
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    params.append('grant_type', 'password');
    
    // Use the shared apiClient to ensure consistent CORS behavior
    const response = await apiClient.post('/auth/login', params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    // Store the token and user data if available
    if (response.data.access_token) {
      localStorage.setItem('token', response.data.access_token);
      
      if (response.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.user));
        console.log('Auth service stored user data:', response.data.user);
      }
    }
    
    return response.data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const logout = async () => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      throw new Error('No token found');
    }
    
    const response = await api.post(`${API_URL}/logout`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    localStorage.removeItem('token');
    return response.data;
  } catch (error) {
    console.error('Logout error:', error);
    // Still remove token on error
    localStorage.removeItem('token');
    throw error;
  }
};

export const checkAuth = async () => {
  try {
    const token = localStorage.getItem('token');
    
    if (!token) {
      return false;
    }
    
    const response = await api.get(`${API_URL}/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    return !!response.data;
  } catch (error) {
    console.error('Auth check error:', error);
    return false;
  }
}; 