import React, { useState, useEffect } from 'react';
import { Alert, Button, Table, Modal, Form, Spinner, InputGroup, FormControl } from 'react-bootstrap';
import { getAllUsers } from '../services/userService';
import { projectService } from '../services/api';
import { jwtDecode } from 'jwt-decode';

const ContactsTab = ({ projectId, effectiveRole }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [addingUser, setAddingUser] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [userToRemove, setUserToRemove] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [editField, setEditField] = useState({ userId: null, value: '' });
  const [updatingField, setUpdatingField] = useState(false);

  // Get current user ID from token
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user.role === 'admin') {
          localStorage.setItem('systemAdmin', 'true');
        } else {
          localStorage.setItem('systemAdmin', 'false');
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
    
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (decoded.user_id) {
          setCurrentUserId(parseInt(decoded.user_id));
        } else if (decoded.sub) {
          // Fallback to sub which might contain username
          setCurrentUserId(decoded.sub);
        }
      } catch (error) {
        console.error('Error decoding token:', error);
      }
    }
  }, []);

  // Handle updating a user's field
  const handleUpdateField = async (userId) => {
    if (!userId) return;
    
    try {
      setUpdatingField(true);
      await projectService.updateMemberField(projectId, userId, editField.value);
      
      // Update the members list with the new field value
      setMembers(members.map(member => 
        member.id === userId 
          ? { ...member, field: editField.value } 
          : member
      ));
      
      // Reset the edit state
      setEditField({ userId: null, value: '' });
      setError('');
    } catch (err) {
      console.error('Error updating user field:', err);
      setError('Failed to update user field. Please try again.');
    } finally {
      setUpdatingField(false);
    }
  };

  // Start editing a field
  const startEditField = (userId, currentField) => {
    setEditField({ userId, value: currentField || '' });
  };

  // Cancel editing
  const cancelEditField = () => {
    setEditField({ userId: null, value: '' });
  };

  // Fetch project members
  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await projectService.getProjectMembers(projectId);
      
      // Log the response for debugging
      console.log("Project members:", response.data);
      
      // Transform data to ensure project role is available
      const processedMembers = response.data.map(member => {
        // Ensure project_role is used correctly (might be coming from a different field)
        const projectRole = member.project_role || member.role;
        return {
          ...member,
          project_role: projectRole
        };
      });
      
      setMembers(processedMembers);
      setError('');
    } catch (err) {
      console.error('Error fetching project members:', err);
      setError('Failed to load project members. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch members on component mount
  useEffect(() => {
    fetchMembers();
  }, [projectId]);

  // Fetch all users when add modal is opened
  useEffect(() => {
    const fetchUsers = async () => {
      if (!showAddUserModal || effectiveRole !== 'ADMIN') return;
      
      try {
        const users = await getAllUsers();
        setAllUsers(users);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users. Please try again.');
      }
    };

    fetchUsers();
  }, [showAddUserModal, effectiveRole]);

  // Handle adding a user to the project
  const handleAddUser = async () => {
    if (!selectedUserId) {
      setError('Please select a user to add');
      return;
    }

    setAddingUser(true);
    setError('');

    try {
      await projectService.addUserToProject(projectId, parseInt(selectedUserId));
      await fetchMembers();
      setShowAddUserModal(false);
      setSelectedUserId('');
    } catch (err) {
      console.error('Error adding user to project:', err);
      setError('Failed to add user to the project. Please try again.');
    } finally {
      setAddingUser(false);
    }
  };

  // Show confirmation modal for removing a user
  const confirmRemoveUser = (user) => {
    setUserToRemove(user);
    setShowConfirmModal(true);
  };

  // Handle removing a user from the project
  const handleRemoveUser = async () => {
    if (!userToRemove) return;

    try {
      await projectService.removeUserFromProject(projectId, userToRemove.id);
      await fetchMembers();
      setShowConfirmModal(false);
      setUserToRemove(null);
      setError('');
    } catch (err) {
      console.error('Error removing user from project:', err);
      
      // Show specific error message if available from API
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Failed to remove user from the project. Please try again.');
      }
      
      setShowConfirmModal(false);
    }
  };

  // Get filtered list of users who are not already in the project
  const availableUsers = allUsers.filter(
    user => !members.some(member => member.id === user.id)
  );

  if (loading && members.length === 0) {
    return <div className="text-center p-4"><Spinner animation="border" /></div>;
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4>Project Contacts</h4>
        {effectiveRole === 'ADMIN' && (
          <Button variant="success" onClick={() => setShowAddUserModal(true)}>
            Add User to Project
          </Button>
        )}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {members.length === 0 ? (
        <Alert variant="info">
          No contacts found for this project.
          {effectiveRole === 'ADMIN' && ' Click "Add User to Project" to add team members.'}
        </Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Username</th>
              <th>Field</th>
              <th>Role</th>
              <th>Status</th>
              {effectiveRole === 'ADMIN' && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map(member => (
              <tr key={member.id}>
                <td>{member.username}</td>
                <td>
                  {editField.userId === member.id ? (
                    <InputGroup>
                      <FormControl
                        value={editField.value}
                        onChange={(e) => setEditField({ ...editField, value: e.target.value })}
                        placeholder="Enter field/area"
                      />
                      <Button variant="success" onClick={() => handleUpdateField(member.id)} disabled={updatingField}>
                        {updatingField ? <Spinner animation="border" size="sm" /> : 'Save'}
                      </Button>
                      <Button variant="secondary" onClick={cancelEditField}>
                        Cancel
                      </Button>
                    </InputGroup>
                  ) : (
                    <div className="d-flex justify-content-between align-items-center">
                      <span>{member.field || 'Not specified'}</span>
                      {effectiveRole === 'ADMIN' && (
                        <Button 
                          variant="outline-primary" 
                          size="sm" 
                          className="ms-2"
                          onClick={() => startEditField(member.id, member.field)}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  <span className={`badge ${member.project_role === 'ADMIN' ? 'bg-primary' : 'bg-secondary'}`}>
                    {member.project_role}
                  </span>
                </td>
                <td>
                  <span className={`badge ${member.is_active ? 'bg-success' : 'bg-danger'}`}>
                    {member.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                {effectiveRole === 'ADMIN' && (
                  <td>
                    {console.log(`Member ${member.username}: role=${member.role}, project_role=${member.project_role}, id=${member.id}, currentId=${currentUserId}`)}
                    {/* Check both the system role and project role - don't allow removing system admins or project admins */}
                    {((member.project_role !== 'ADMIN' && member.role !== 'admin') || member.id === currentUserId || localStorage.getItem('systemAdmin') === 'true') ? (
                      <Button 
                        variant="danger" 
                        size="sm"
                        onClick={() => confirmRemoveUser(member)}
                      >
                        Remove
                      </Button>
                    ) : (
                      <span className="text-muted">Cannot remove admins</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* Add User Modal */}
      <Modal
        show={showAddUserModal}
        onHide={() => setShowAddUserModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Add User to Project</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          
          {availableUsers.length === 0 ? (
            <Alert variant="info">
              No available users to add. All users are already in this project.
            </Alert>
          ) : (
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Select User</Form.Label>
                <Form.Select 
                  value={selectedUserId} 
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  <option value="">-- Select a user --</option>
                  {availableUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.username} ({user.email})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddUserModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleAddUser}
            disabled={!selectedUserId || addingUser}
          >
            {addingUser ? 'Adding...' : 'Add User'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Confirm Remove Modal */}
      <Modal
        show={showConfirmModal}
        onHide={() => setShowConfirmModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Confirm Removal</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to remove <strong>{userToRemove?.username}</strong> from this project?
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleRemoveUser}>
            Remove
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ContactsTab; 