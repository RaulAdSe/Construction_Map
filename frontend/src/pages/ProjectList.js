import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Navbar, Spinner, Alert, Modal, Form, Tabs, Tab } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../services/api';
import { isUserAdmin } from '../utils/permissions';
import MonitoringDashboard from '../components/monitoring/MonitoringDashboard';
import NotificationBell from '../components/NotificationBell';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import MobileSwitcher from '../components/common/MobileSwitcher';
import { useMobile } from '../components/common/MobileProvider';
import '../assets/styles/ProjectList.css';
import translate from '../utils/translate';

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
  const [activeTab, setActiveTab] = useState('projects');
  const navigate = useNavigate();
  const { isMobile } = useMobile();

  useEffect(() => {
    loadProjects();
  }, []);

  // Helper function to format dates safely
  const formatDate = (dateString) => {
    if (!dateString) return translate('Date unavailable');
    
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) return translate('Invalid date');
    
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
      const response = await projectService.getProjects();
      setProjects(response.data);
      setError('');
    } catch (err) {
      console.error('Error loading projects:', err);
      setError(translate('Failed to load projects. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = (projectId) => {
    navigate(`/project/${projectId}`);
  };

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      setError(translate('Project name is required'));
      return;
    }
    
    try {
      setCreating(true);
      await projectService.createProject(newProject);
      setShowModal(false);
      setNewProject({ name: '', description: '' });
      setError('');
      await loadProjects(); // Reload the projects list
    } catch (err) {
      console.error('Error creating project:', err);
      setError(translate('Failed to create project. Please try again.'));
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
      await projectService.deleteProject(projectToDelete.id);
      setShowDeleteModal(false);
      setProjectToDelete(null);
      // Show success message and reload projects
      setError('');
      await loadProjects();
    } catch (err) {
      console.error('Error deleting project:', err);
      setError(translate('Failed to delete project. Please try again.'));
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setNewProject({ name: '', description: '' });
    setError('');
  };

  // Render the projects tab content
  const renderProjectsTab = () => {
    if (loading) {
      return (
        <div className="text-center p-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">{translate('Loading...')}</span>
          </Spinner>
        </div>
      );
    }
    
    if (projects.length === 0) {
      return (
        <div className="text-center p-5 bg-light rounded">
          <h3>{translate('No Projects Available')}</h3>
          <p>{translate('There are no projects in the system yet. Create your first project to get started!')}</p>
          <Button variant="primary" size="lg" onClick={() => setShowModal(true)}>
            {translate('Create Your First Project')}
          </Button>
        </div>
      );
    }
    
    // Different card layout for mobile and desktop
    if (isMobile) {
      // Mobile layout - stack cards vertically, full width
      return (
        <div className="mobile-projects-list">
          {projects.map(project => (
            <Card key={project.id} className="project-card mb-3">
              <Card.Body onClick={() => handleProjectSelect(project.id)}>
                <div className="d-flex justify-content-between align-items-center">
                  <Card.Title>{project.name}</Card.Title>
                  <Button 
                    variant="danger" 
                    size="sm"
                    onClick={(e) => handleDeleteClick(e, project)}
                    aria-label={`${translate('Delete')} ${project.name} ${translate('project')}`}
                  >
                    <i className="bi bi-trash"></i>
                  </Button>
                </div>
                <Card.Text className="mt-2">
                  {project.description || translate('No description available')}
                </Card.Text>
                <div className="text-muted mt-2">
                  <small>{translate('Created')}: {formatDate(project.created_at)}</small>
                </div>
              </Card.Body>
            </Card>
          ))}
        </div>
      );
    } else {
      // Desktop layout - grid of cards
      return (
        <Row xs={1} md={2} lg={3} className="g-4">
          {projects.map(project => (
            <Col key={project.id}>
              <Card className="project-card h-100">
                <Button 
                  variant="danger" 
                  size="sm" 
                  className="delete-project-btn"
                  onClick={(e) => handleDeleteClick(e, project)}
                  aria-label={`${translate('Delete')} ${project.name} ${translate('project')}`}
                >
                  <i className="bi bi-trash"></i>
                </Button>
                <Card.Body onClick={() => handleProjectSelect(project.id)}>
                  <Card.Title>{project.name}</Card.Title>
                  <Card.Text>
                    {project.description || translate('No description available')}
                  </Card.Text>
                </Card.Body>
                <Card.Footer onClick={() => handleProjectSelect(project.id)}>
                  <small className="text-muted">
                    {translate('Created')}: {formatDate(project.created_at)}
                  </small>
                </Card.Footer>
              </Card>
            </Col>
          ))}
        </Row>
      );
    }
  };

  // Mobile navbar is more compact
  const renderNavbar = () => {
    if (isMobile) {
      return (
        <Navbar bg="dark" variant="dark" expand="lg">
          <Container fluid>
            <Navbar.Brand>{translate('Construction Map Viewer')}</Navbar.Brand>
            <div className="d-flex align-items-center">
              <NotificationBell />
              <LanguageSwitcher />
              <MobileSwitcher />
              <Button variant="outline-light" onClick={onLogout} size="sm" className="ms-2">
                <i className="bi bi-box-arrow-right"></i>
              </Button>
            </div>
          </Container>
        </Navbar>
      );
    }
    
    return (
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand>{translate('Construction Map Viewer')}</Navbar.Brand>
          <div className="d-flex align-items-center">
            <NotificationBell />
            <LanguageSwitcher />
            <MobileSwitcher />
            <Button variant="outline-light" onClick={onLogout} className="ms-3">{translate('Logout')}</Button>
          </div>
        </Container>
      </Navbar>
    );
  };

  return (
    <div className={`project-list-page ${isMobile ? 'mobile-view' : ''}`}>
      {renderNavbar()}

      <Container className={isMobile ? "mt-2 px-2" : "mt-4"}>
        <Tabs
          activeKey={activeTab}
          onSelect={setActiveTab}
          id="project-tabs"
          className="mb-3"
        >
          <Tab eventKey="projects" title={translate('Projects')}>
            <div className={`d-flex justify-content-between align-items-center ${isMobile ? 'mb-2' : 'mb-4'}`}>
              <h2 className={isMobile ? "h4" : "h2"}>{translate('Select a Project')}</h2>
              <Button 
                variant="primary" 
                className="create-project-btn" 
                onClick={() => setShowModal(true)}
                size={isMobile ? "sm" : "md"}
              >
                <i className="bi bi-plus-lg"></i>
                {isMobile ? '' : translate('Create New Project')}
              </Button>
            </div>
            
            {error && (
              <Alert variant="danger" onClose={() => setError('')} dismissible>
                {error}
              </Alert>
            )}
            
            {renderProjectsTab()}
          </Tab>
          
          {isUserAdmin() && (
            <Tab eventKey="monitoring" title={translate('System Monitoring')}>
              <MonitoringDashboard />
            </Tab>
          )}
        </Tabs>
      </Container>

      {/* Create Project Modal */}
      <Modal show={showModal} onHide={() => { setShowModal(false); resetForm(); }} fullscreen={isMobile}>
        <Modal.Header closeButton>
          <Modal.Title>{translate('Create New Project')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form className="project-form">
            <Form.Group className="mb-3">
              <Form.Label>{translate('Project Name')} <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="text"
                placeholder={translate('Enter project name')}
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>{translate('Description')}</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder={translate('Enter project description (optional)')}
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setShowModal(false); resetForm(); }}>
            {translate('Cancel')}
          </Button>
          <Button 
            variant="primary" 
            onClick={handleCreateProject}
            disabled={creating}
          >
            {creating ? translate('Creating...') : translate('Create')}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Project Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} fullscreen={isMobile}>
        <Modal.Header closeButton>
          <Modal.Title>{translate('Confirm Delete')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {projectToDelete && (
            <p>{translate('Are you sure you want to delete project')}: <strong>{projectToDelete.name}</strong>? {translate('This action cannot be undone')}.</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            {translate('Cancel')}
          </Button>
          <Button 
            variant="danger" 
            onClick={handleDeleteProject}
            disabled={deleting}
          >
            {deleting ? translate('Deleting...') : translate('Delete')}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ProjectList; 