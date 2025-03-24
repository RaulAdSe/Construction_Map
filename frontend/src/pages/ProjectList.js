import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Navbar, Spinner, Alert, Modal, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { fetchProjects, createProject, deleteProject } from '../services/mapService';
import '../assets/styles/ProjectList.css';

const ProjectList = ({ onLogout }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [newProject, setNewProject] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  // Helper function to format dates safely
  const formatDate = (dateString) => {
    if (!dateString) return 'Date unavailable';
    
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) return 'Invalid date';
    
    // Format the date
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

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

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      setError('Project name is required');
      return;
    }
    
    try {
      setCreating(true);
      await createProject(newProject);
      setShowModal(false);
      setNewProject({ name: '', description: '' });
      setError('');
      await loadProjects(); // Reload the projects list
    } catch (err) {
      console.error('Error creating project:', err);
      setError('Failed to create project. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteClick = (e, project) => {
    e.stopPropagation(); // Prevent card click from triggering
    setProjectToDelete(project);
    setShowDeleteModal(true);
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    
    try {
      setDeleting(true);
      await deleteProject(projectToDelete.id);
      setShowDeleteModal(false);
      setProjectToDelete(null);
      // Show success message and reload projects
      setError('');
      await loadProjects();
    } catch (err) {
      console.error('Error deleting project:', err);
      setError('Failed to delete project. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setNewProject({ name: '', description: '' });
    setError('');
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
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2>Select a Project</h2>
          <Button variant="primary" className="create-project-btn" onClick={() => setShowModal(true)}>
            <i className="bi bi-plus-lg"></i>Create New Project
          </Button>
        </div>
        
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
            <p>There are no projects in the system yet. Create your first project to get started!</p>
            <Button variant="primary" size="lg" onClick={() => setShowModal(true)}>
              Create Your First Project
            </Button>
          </div>
        ) : (
          <Row xs={1} md={2} lg={3} className="g-4">
            {projects.map(project => (
              <Col key={project.id}>
                <Card className="project-card h-100">
                  <Button 
                    variant="danger" 
                    size="sm" 
                    className="delete-project-btn"
                    onClick={(e) => handleDeleteClick(e, project)}
                    aria-label={`Delete ${project.name} project`}
                  >
                    <i className="bi bi-trash"></i>
                  </Button>
                  <Card.Body onClick={() => handleProjectSelect(project.id)}>
                    <Card.Title>{project.name}</Card.Title>
                    <Card.Text>
                      {project.description || 'No description available'}
                    </Card.Text>
                  </Card.Body>
                  <Card.Footer onClick={() => handleProjectSelect(project.id)}>
                    <small className="text-muted">
                      Created: {formatDate(project.created_at)}
                    </small>
                  </Card.Footer>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Container>

      {/* Create Project Modal */}
      <Modal show={showModal} onHide={() => { setShowModal(false); resetForm(); }}>
        <Modal.Header closeButton>
          <Modal.Title>Create New Project</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form className="project-form">
            <Form.Group className="mb-3">
              <Form.Label>Project Name <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter project name"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Enter project description (optional)"
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleCreateProject}
            disabled={creating}
          >
            {creating ? (
              <>
                <Spinner as="span" animation="border" size="sm" className="me-2" />
                Creating...
              </>
            ) : 'Create Project'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Project Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete Project</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Are you sure you want to delete project <strong>{projectToDelete?.name}</strong>?</p>
          <Alert variant="warning">
            <i className="bi bi-exclamation-triangle me-2"></i>
            This action will permanently delete this project and all its associated maps and events. 
            This cannot be undone.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={handleDeleteProject}
            disabled={deleting}
          >
            {deleting ? (
              <>
                <Spinner as="span" animation="border" size="sm" className="me-2" />
                Deleting...
              </>
            ) : 'Delete Project'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ProjectList; 