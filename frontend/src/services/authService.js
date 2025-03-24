import axios from 'axios';

const API_URL = 'http://localhost:8000/api/v1/auth';

// Configure axios with longer timeout
const api = axios.create({
  baseURL: API_URL,
  timeout: 20000, // 20 seconds
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

export const login = async (username, password) => {
  try {
    console.log(`Attempting to login at ${API_URL}/login with username: ${username}`);
    
    // Create form data
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    
    // Use axios directly with explicit configuration
    const response = await axios({
      method: 'post',
      url: `${API_URL}/login`,
      data: formData,
      headers: { 
        'Accept': 'application/json',
        'Content-Type': 'multipart/form-data'
      },
      timeout: 20000, // 20 seconds timeout
      withCredentials: false // Disable credentials for development
    });
    
    console.log('Login response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Login error details:', {
      message: error.message,
      code: error.code,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : 'No response'
    });
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