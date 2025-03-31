import React, { useState, useEffect } from 'react';
import { Alert, Button, Table, Modal, Form, Spinner, InputGroup, FormControl, Badge } from 'react-bootstrap';
import { getAllUsers } from '../services/userService';
import { projectService } from '../services/api';
import { jwtDecode } from 'jwt-decode';
import { isUserAdmin, canPerformAdminAction } from '../utils/permissions';

const ContactsTab = ({ projectId, effectiveIsAdmin }) => {
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
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const [editField, setEditField] = useState({ userId: null, value: '' });
  const [updatingField, setUpdatingField] = useState(false);

  // Get current user ID from token
  useEffect(() => {
    // Initialize admin state based on the effectiveIsAdmin prop
    setIsCurrentUserAdmin(effectiveIsAdmin === true);
    
    const token = localStorage.getItem('token');
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
  }, [effectiveIsAdmin]);

  // Start editing a field - add additional safeguards
  const startEditField = (userId, currentField) => {
    // Block all editing for non-admin users with strict checking
    if (effectiveIsAdmin !== true) {
      setError('You do not have permission to edit fields. Only administrators can make changes.');
      console.warn('Non-admin user attempted to edit a field');
      return;
    }
    
    setEditField({ userId, value: currentField || '' });
  };

  // Cancel editing
  const cancelEditField = () => {
    setEditField({ userId: null, value: '' });
  };

  // Handle updating a user's field - add additional safeguards
  const handleUpdateField = async (userId) => {
    if (!userId) return;
    
    // Block all updates for non-admin users with strict checking
    if (effectiveIsAdmin !== true) {
      setError('You do not have permission to update user fields. Only administrators can make changes.');
      console.warn('Non-admin user attempted to update a field');
      cancelEditField();
      return;
    }
    
    try {
      const fieldValue = editField.value.trim();
      console.log(`Submitting field update for user ${userId}: "${fieldValue}"`);
      
      setUpdatingField(true);
      
      // Make API call to update the field
      const response = await projectService.updateMemberField(projectId, userId, fieldValue);
      console.log('Field update response:', response);
      
      // Update the members list with the new field value
      setMembers(members.map(member => 
        member.id === userId 
          ? { ...member, field: fieldValue } 
          : member
      ));
      
      // Reset the edit state
      setEditField({ userId: null, value: '' });
      setError('');
    } catch (err) {
      console.error('Error updating user field:', err);
      
      // Show more detailed error message if available
      if (err.response && err.response.data && err.response.data.detail) {
        setError(`Error: ${err.response.data.detail}`);
      } else {
        setError('Failed to update user field. Please try again.');
      }
    } finally {
      setUpdatingField(false);
    }
  };

  // Handle toggling a user's admin status
  const handleToggleAdminStatus = async (userId, currentIsAdmin) => {
    try {
      await projectService.updateMemberRole(projectId, userId, !currentIsAdmin);
      
      // Update the members list with the new admin status
      setMembers(members.map(member => 
        member.id === userId 
          ? { ...member, is_admin: !currentIsAdmin } 
          : member
      ));
      
      setError('');
    } catch (err) {
      console.error('Error updating user admin status:', err);
      
      // Show more detailed error message if available
      if (err.response && err.response.data && err.response.data.detail) {
        setError(`Error: ${err.response.data.detail}`);
      } else {
        setError('Failed to update user admin status. Please try again.');
      }
    }
  };

  // Fetch project members
  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await projectService.getProjectMembers(projectId);
      
      // Log the response for debugging
      console.log("Project members:", response.data);
      
      // Process members data
      const processedMembers = response.data.map(member => {
        return {
          ...member,
          // Ensure we have the field value
          field: member.field || ''
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
      if (!showAddUserModal || !effectiveIsAdmin) return;
      
      try {
        const users = await getAllUsers();
        setAllUsers(users);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users. Please try again.');
      }
    };

    fetchUsers();
  }, [showAddUserModal, effectiveIsAdmin]);

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

  console.log('Rendering ContactsTab with isCurrentUserAdmin:', isCurrentUserAdmin, 'and effectiveIsAdmin:', effectiveIsAdmin);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4>Project Contacts</h4>
        {effectiveIsAdmin === true && (
          <Button variant="success" onClick={() => setShowAddUserModal(true)}>
            Add User to Project
          </Button>
        )}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {effectiveIsAdmin !== true && (
        <Alert variant="info">
          You are viewing contacts in read-only mode. Only administrators can make changes.
        </Alert>
      )}

      {loading ? (
        <div className="text-center">
          <Spinner animation="border" />
          <p className="mt-2">Loading project contacts...</p>
        </div>
      ) : members.length === 0 ? (
        <Alert variant="info">
          No contacts found for this project.
          {effectiveIsAdmin === true && ' Click "Add User to Project" to add team members.'}
        </Alert>
      ) : (
        <Table striped bordered hover responsive>
          <thead>
            <tr>
              <th>Username</th>
              <th>Field</th>
              <th>Role</th>
              <th>Status</th>
              {effectiveIsAdmin === true && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map(member => (
              <tr key={member.id}>
                <td>{member.username}</td>
                <td>
                  {/* Only render edit form for admins with strict checking */}
                  {editField.userId === member.id && effectiveIsAdmin === true ? (
                    <Form.Group className="d-flex align-items-center">
                      <Form.Control
                        type="text"
                        value={editField.value}
                        onChange={(e) => setEditField({ ...editField, value: e.target.value })}
                        size="sm"
                        className="me-2"
                      />
                      {updatingField ? (
                        <Spinner animation="border" size="sm" />
                      ) : (
                        <>
                          <Button variant="success" size="sm" onClick={() => handleUpdateField(member.id)}>
                            <i className="bi bi-check"></i>
                          </Button>
                          <Button variant="secondary" size="sm" className="ms-1" onClick={cancelEditField}>
                            <i className="bi bi-x"></i>
                          </Button>
                        </>
                      )}
                    </Form.Group>
                  ) : (
                    <div className="d-flex justify-content-between align-items-center">
                      <span>{member.field || "-"}</span>
                      {/* Strict check to ensure members never see edit button */}
                      {(effectiveIsAdmin === true) && (
                        <Button 
                          variant="outline-primary" 
                          size="sm" 
                          className="ms-2"
                          onClick={() => startEditField(member.id, member.field)}
                        >
                          <i className="bi bi-pencil"></i>
                        </Button>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  <Badge 
                    bg={member.is_admin ? "primary" : "secondary"}
                  >
                    {member.is_admin ? "Admin" : "Member"}
                  </Badge>
                </td>
                <td>
                  <span className={`badge ${member.is_active ? 'bg-success' : 'bg-danger'}`}>
                    {member.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                {effectiveIsAdmin === true && (
                  <td>
                    {(!member.is_admin || member.id === currentUserId) ? (
                      <Button 
                        variant="danger" 
                        size="sm"
                        onClick={() => confirmRemoveUser(member)}
                      >
                        <i className="bi bi-trash"></i>
                      </Button>
                    ) : (
                      <span className="text-muted">Cannot remove other admins</span>
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