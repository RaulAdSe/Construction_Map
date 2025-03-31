import React, { useState } from 'react';
import { Form, Button, Container, Row, Col, Alert } from 'react-bootstrap';
import '../assets/styles/LoginPage.css';
import { login } from '../services/authService';

const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      setError('Please enter both username and password');
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
          localStorage.setItem('user', JSON.stringify(data.user));
          console.log('Stored user data:', data.user);
        } else {
          // If no user data, create basic user data based on username
          const user = {
            username: username,
            is_admin: username === 'admin', // Assume username 'admin' is an admin
            id: username
          };
          localStorage.setItem('user', JSON.stringify(user));
          console.log('Created basic user data:', user);
        }
        
        onLogin();
      } else {
        throw new Error('No access token received');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Row className="justify-content-md-center">
        <Col md={6}>
          <div className="login-container">
            <h2>Construction Map Viewer</h2>
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Username</Form.Label>
                <Form.Control 
                  type="text" 
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username" 
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Password</Form.Label>
                <Form.Control 
                  type="password" 
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password" 
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
                {loading ? 'Logging in...' : 'Log In'}
              </Button>
            </Form>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default LoginPage; 