import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Button, Alert, Tab, Tabs, Form, Modal, Table, Navbar } from 'react-bootstrap';
import { projectService, mapService } from '../services/api';
import RoleSwitcher from '../components/RoleSwitcher';

const ProjectDetail = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  const [project, setProject] = useState(null);
  const [maps, setMaps] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMapModal, setShowMapModal] = useState(false);
  const [newMap, setNewMap] = useState({ name: '', file: null });
  const [uploadError, setUploadError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [effectiveRole, setEffectiveRole] = useState(null);

  useEffect(() => {
    fetchProjectDetails();
    fetchCurrentUser();
  }, [projectId]);

  const fetchCurrentUser = async () => {
    try {
      // Get user ID from JWT token
      const token = localStorage.getItem('token');
      if (token) {
        // Parse token (token is in the format xxx.yyy.zzz where yyy is the payload)
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Get username from token sub claim
        const username = payload.sub;
        
        // For now we'll just create a minimal user object with the username
        const user = { 
          id: username, // Using username as ID for now
          username: username
        };
        
        setCurrentUser(user);
        
        // If we have a project ID, fetch the user's role
        if (projectId) {
          try {
            const membersResponse = await projectService.getProjectMembers(projectId);
            const members = membersResponse.data;
            const currentMember = members.find(member => member.username === username);
            
            if (currentMember) {
              setUserRole(currentMember.role);
              setEffectiveRole(currentMember.role); // Initially set to actual role
            }
          } catch (error) {
            console.error('Error fetching user role:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchProjectDetails = async () => {
    try {
      setLoading(true);
      const projectResponse = await projectService.getProject(projectId);
      setProject(projectResponse.data);
      
      // Fetch maps for this project
      const mapsResponse = await mapService.getMaps();
      // Filter maps by this project
      const projectMaps = mapsResponse.data.filter(map => map.project_id === parseInt(projectId));
      setMaps(projectMaps);
      
      // Fetch project members
      const membersResponse = await projectService.getProjectMembers(projectId);
      setMembers(membersResponse.data);
      
      setError('');
    } catch (err) {
      console.error('Error fetching project details:', err);
      setError('Failed to load project details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle role change from the RoleSwitcher
  const handleRoleChange = (newRole) => {
    setEffectiveRole(newRole);
  };

  const handleFileChange = (e) => {
    setNewMap({ ...newMap, file: e.target.files[0] });
  };

  const handleMapUpload = async () => {
    try {
      if (!newMap.name) {
        setUploadError('Map name is required');
        return;
      }
      
      if (!newMap.file) {
        setUploadError('Please select a file to upload');
        return;
      }
      
      const mapData = {
        project_id: projectId,
        name: newMap.name,
        file: newMap.file
      };
      
      await mapService.createMap(mapData);
      setShowMapModal(false);
      setNewMap({ name: '', file: null });
      setUploadError('');
      fetchProjectDetails();
    } catch (err) {
      console.error('Error uploading map:', err);
      setUploadError('Failed to upload map. Please try again.');
    }
  };

  const viewMap = (mapId) => {
    navigate(`/maps/${mapId}`);
  };

  if (loading) {
    return <Container><p className="text-center mt-5">Loading project details...</p></Container>;
  }

  if (!project) {
    return (
      <Container>
        <Alert variant="danger">
          Project not found or you don't have access.
        </Alert>
        <Button variant="primary" onClick={() => navigate('/projects')}>
          Back to Projects
        </Button>
      </Container>
    );
  }

  return (
    <Container>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <Button variant="outline-secondary" onClick={() => navigate('/projects')}>
          ← Back to Projects
        </Button>
        
        {userRole === "ADMIN" && (
          <RoleSwitcher 
            currentRole={effectiveRole}
            onRoleChange={handleRoleChange}
            isAdminUser={userRole === "ADMIN"}
          />
        )}
      </div>

      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>{project.name}</h2>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Tabs className="mb-4" defaultActiveKey="maps">
        <Tab eventKey="details" title="Project Details">
          <Card>
            <Card.Body>
              <h5>Description</h5>
              <p>{project.description || 'No description provided.'}</p>

              <h5 className="mt-4">Project Information</h5>
              <p>Created: {new Date(project.created_at).toLocaleString()}</p>
              <p>Last Updated: {new Date(project.updated_at).toLocaleString()}</p>
            </Card.Body>
          </Card>
        </Tab>
        
        <Tab eventKey="maps" title="Maps">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4>Project Maps</h4>
            {effectiveRole === "ADMIN" && (
              <Button variant="success" onClick={() => setShowMapModal(true)}>
                Upload Map
              </Button>
            )}
          </div>

          {maps.length === 0 ? (
            <Alert variant="info">
              No maps found for this project. {effectiveRole === "ADMIN" ? "Click \"Upload Map\" to add a new map." : ""}
            </Alert>
          ) : (
            <Row>
              {maps.map((map) => (
                <Col key={map.id} md={4} className="mb-4">
                  <Card className="h-100">
                    <Card.Img 
                      variant="top" 
                      src={`http://localhost:8000/uploads/${map.file_path}`} 
                      style={{ height: '180px', objectFit: 'cover' }}
                    />
                    <Card.Body>
                      <Card.Title>{map.name}</Card.Title>
                      <Card.Text>Uploaded on: {new Date(map.created_at).toLocaleDateString()}</Card.Text>
                    </Card.Body>
                    <Card.Footer>
                      <Button 
                        variant="primary" 
                        onClick={() => viewMap(map.id)}
                        className="w-100"
                      >
                        View Map
                      </Button>
                    </Card.Footer>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Tab>
        
        <Tab eventKey="members" title="Team Members">
          <h4>Project Team</h4>
          <p>Contact information for all team members working on this project.</p>
          
          {members.length === 0 ? (
            <Alert variant="info">
              No team members found for this project.
            </Alert>
          ) : (
            <Card>
              <Card.Body>
                <Table striped bordered hover responsive>
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member) => (
                      <tr key={member.id}>
                        <td>{member.username}</td>
                        <td>
                          <a href={`mailto:${member.email}`}>
                            {member.email}
                          </a>
                        </td>
                        <td>
                          <span className={`badge ${member.role === 'ADMIN' ? 'bg-primary' : 'bg-secondary'}`}>
                            {member.role}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${member.is_active ? 'bg-success' : 'bg-danger'}`}>
                            {member.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          )}
        </Tab>
      </Tabs>

      {/* Upload Map Modal */}
      <Modal show={showMapModal} onHide={() => setShowMapModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Upload New Map</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {uploadError && <Alert variant="danger">{uploadError}</Alert>}
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Map Name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter map name"
                value={newMap.name}
                onChange={(e) => setNewMap({ ...newMap, name: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Map File</Form.Label>
              <Form.Control
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                required
              />
              <Form.Text className="text-muted">
                Upload a JPG, PNG or GIF file of your construction map.
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowMapModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleMapUpload}>
            Upload Map
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ProjectDetail; 