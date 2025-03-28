import React, { useState, useEffect } from 'react';
import { Alert, Button, Table, Modal, Form, Spinner } from 'react-bootstrap';
import { getAllUsers } from '../services/userService';
import { projectService } from '../services/api';

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

  // Fetch project members
  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await projectService.getProjectMembers(projectId);
      setMembers(response.data);
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
    } catch (err) {
      console.error('Error removing user from project:', err);
      setError('Failed to remove user from the project. Please try again.');
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
              <th>Email</th>
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
                {effectiveRole === 'ADMIN' && (
                  <td>
                    <Button 
                      variant="danger" 
                      size="sm"
                      onClick={() => confirmRemoveUser(member)}
                    >
                      Remove
                    </Button>
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