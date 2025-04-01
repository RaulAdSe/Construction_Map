import React, { useState } from 'react';
import { Form, Button, Container, Row, Col, Alert } from 'react-bootstrap';
import '../assets/styles/LoginPage.css';
import { login } from '../services/authService';
import translate from '../utils/translate';
import { getCurrentLanguage } from '../utils/translate';
import LanguageSwitcher from '../components/common/LanguageSwitcher';

const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      setError(translate('Please enter both username and password'));
      return;
    }

    setError('');
    setLoading(true);
    
    try {
      const data = await login(username, password);
      
      if (data.access_token) {
        localStorage.setItem('token', data.access_token);
        
        // Store user data in localStorage
        if (data.user) {
          // Store current language preference with the user
          const userData = {
            ...data.user,
            language_preference: getCurrentLanguage()
          };
          localStorage.setItem('user', JSON.stringify(userData));
          console.log('Stored user data with language preference:', userData);
        } else {
          // If no user data, create basic user data based on username
          const user = {
            username: username,
            is_admin: username === 'admin', // Assume username 'admin' is an admin
            id: username,
            language_preference: getCurrentLanguage()
          };
          localStorage.setItem('user', JSON.stringify(user));
          console.log('Created basic user data with language preference:', user);
        }
        
        onLogin();
      } else {
        throw new Error('No access token received');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(translate('Login failed. Please check your credentials.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Row className="justify-content-md-center">
        <Col md={6}>
          <div className="login-container">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2>{translate('Construction Map Viewer')}</h2>
              <LanguageSwitcher />
            </div>
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>{translate('Username')}</Form.Label>
                <Form.Control 
                  type="text" 
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={translate('Enter username')} 
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>{translate('Password')}</Form.Label>
                <Form.Control 
                  type="password" 
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={translate('Password')} 
                  required
                />
              </Form.Group>

              {error && <Alert variant="danger">{error}</Alert>}

              <Button 
                variant="primary" 
                type="submit" 
                className="login-button"
                disabled={loading}
              >
                {loading ? translate('Logging in...') : translate('Log In')}
              </Button>
            </Form>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default LoginPage; 