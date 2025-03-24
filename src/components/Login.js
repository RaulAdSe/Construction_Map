import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Button, Container, Card, Alert } from 'react-bootstrap';
import { authService } from '../services/api';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }
    
    try {
      setError('');
      setLoading(true);
      const response = await authService.login(username, password);
      
      if (response) {
        navigate('/projects');
      } else {
        setError('Failed to log in');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  // For demo purposes - allow quick login
  const handleDemoLogin = async () => {
    try {
      setError('');
      setLoading(true);
      // Try to login with default admin credentials
      const response = await authService.login('admin', 'admin');
      
      if (response) {
        navigate('/projects');
      } else {
        setError('Demo login failed');
      }
    } catch (err) {
      console.error('Demo login error:', err);
      setError('Unable to use demo login. Please check if the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="login-container">
      <Card>
        <Card.Body>
          <Card.Title className="text-center mb-4">Construction Map Login</Card.Title>
          {error && <Alert variant="danger">{error}</Alert>}
          
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="username">
              <Form.Label>Username</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="password">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Form.Group>

            <div className="d-grid gap-2">
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </Button>
              
              <Button 
                variant="outline-secondary" 
                type="button" 
                onClick={handleDemoLogin}
                disabled={loading}
              >
                Demo Login (Admin)
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Login; 