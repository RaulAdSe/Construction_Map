import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Navbar, Spinner, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { fetchProjects } from '../services/mapService';
import '../assets/styles/ProjectList.css';

const ProjectList = ({ onLogout }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const projectsData = await fetchProjects();
      setProjects(projectsData);
      setError('');
    } catch (err) {
      console.error('Error loading projects:', err);
      setError('Failed to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = (projectId) => {
    navigate(`/project/${projectId}`);
  };

  return (
    <div className="project-list-page">
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand>Construction Map Viewer</Navbar.Brand>
          <Button variant="outline-light" onClick={onLogout}>Logout</Button>
        </Container>
      </Navbar>

      <Container className="mt-4">
        <h2 className="text-center mb-4">Select a Project</h2>
        
        {error && (
          <Alert variant="danger" onClose={() => setError('')} dismissible>
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="text-center p-5">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center p-5 bg-light rounded">
            <h3>No Projects Available</h3>
            <p>There are no projects in the system yet.</p>
          </div>
        ) : (
          <Row xs={1} md={2} lg={3} className="g-4">
            {projects.map(project => (
              <Col key={project.id}>
                <Card 
                  className="project-card h-100" 
                  onClick={() => handleProjectSelect(project.id)}
                >
                  <Card.Body>
                    <Card.Title>{project.name}</Card.Title>
                    <Card.Text>
                      {project.description || 'No description available'}
                    </Card.Text>
                  </Card.Body>
                  <Card.Footer>
                    <small className="text-muted">
                      Created: {new Date(project.created_at).toLocaleDateString()}
                    </small>
                  </Card.Footer>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Container>
    </div>
  );
};

export default ProjectList; 