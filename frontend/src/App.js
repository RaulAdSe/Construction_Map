import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import MapViewer from './pages/MapViewer';
import ProjectList from './pages/ProjectList';
import './assets/styles/App.css';
import { TranslationProvider } from './components/common/TranslationProvider';
import { setLanguage } from './utils/translate';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  useEffect(() => {
    // Check if user has a valid token
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
      
      // Load user's language preference
      try {
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        if (userData.language_preference) {
          // Set language based on user preference
          setLanguage(userData.language_preference);
          console.log('Loaded user language preference:', userData.language_preference);
        }
      } catch (error) {
        console.error('Error loading user language preference:', error);
      }
    }
  }, []);
  
  const handleLogin = () => {
    setIsAuthenticated(true);
  };
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
  };
  
  return (
    <TranslationProvider>
      <Router>
        <Routes>
          <Route 
            path="/" 
            element={isAuthenticated ? <Navigate to="/projects" /> : <LoginPage onLogin={handleLogin} />} 
          />
          <Route 
            path="/projects" 
            element={isAuthenticated ? <ProjectList onLogout={handleLogout} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/project/:projectId" 
            element={isAuthenticated ? <MapViewer onLogout={handleLogout} /> : <Navigate to="/" />} 
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </TranslationProvider>
  );
}

export default App; 