import React, { useState } from 'react';
import { Form, Button, Container, Row, Col, Alert, Image } from 'react-bootstrap';
import '../assets/styles/LoginPage.css';
import { login } from '../services/authService';
import translate from '../utils/translate';
import { getCurrentLanguage } from '../utils/translate';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import MobileSwitcher from '../components/common/MobileSwitcher';
import { useMobile } from '../components/common/MobileProvider';

const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { isMobile } = useMobile();

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
        } else {
          // If no user data, create basic user data based on username
          const user = {
            username: username,
            is_admin: username === 'admin', // Assume username 'admin' is an admin
            id: username,
            language_preference: getCurrentLanguage()
          };
          localStorage.setItem('user', JSON.stringify(user));
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
    <Container className={isMobile ? 'p-2' : ''}>
      <Row className="justify-content-md-center">
        <Col xs={12} md={6}>
          <div className={`login-container ${isMobile ? 'mobile-login' : ''}`}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2 className={isMobile ? 'h3' : 'h2'}>{translate('Construction Map Viewer')}</h2>
              <div className="d-flex">
                <LanguageSwitcher />
                <MobileSwitcher />
              </div>
            </div>
            
            {isMobile && (
              <div className="text-center mb-4">
                <Image 
                  src="/logo-small.png" 
                  alt="Logo"
                  width={80}
                  height={80}
                  className="login-logo"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}
            
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>{translate('Username')}</Form.Label>
                <Form.Control 
                  type="text" 
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={translate('Enter username')} 
                  className={isMobile ? 'form-control-lg' : ''}
                  required
                  autoComplete="username"
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
                  className={isMobile ? 'form-control-lg' : ''}
                  required
                  autoComplete="current-password"
                />
              </Form.Group>

              {error && <Alert variant="danger">{error}</Alert>}

              <Button 
                variant="primary" 
                type="submit" 
                className={`login-button ${isMobile ? 'btn-lg mt-4' : ''}`}
                disabled={loading}
                size={isMobile ? "lg" : "md"}
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