import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ListGroup, Spinner } from 'react-bootstrap';
import { projectService } from '../services/api';

const MentionSuggestions = ({ 
  text, 
  position, 
  onSelectUser, 
  projectId, 
  isVisible, 
  setIsVisible 
}) => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [error, setError] = useState(null);

  // Fetch project users when component mounts or becomes visible
  const fetchProjectUsers = useCallback(async () => {
    if (!projectId || !isVisible) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await projectService.getProjectMembers(projectId);
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching project users:', error);
      // Don't show error if it's just a 404 (project not found)
      if (error.response && error.response.status === 404) {
        // Project might not exist or user doesn't have access
        setUsers([]);
      } else {
        setError('Could not load users');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, isVisible]);

  // Trigger fetch when visibility changes
  useEffect(() => {
    if (isVisible) {
      fetchProjectUsers();
    }
  }, [isVisible, fetchProjectUsers]);

  // Extract query text after @ symbol
  const getQueryFromText = useCallback(() => {
    if (!text) return '';
    
    const lastAtSymbolIndex = text.lastIndexOf('@');
    if (lastAtSymbolIndex === -1) return '';
    
    const textAfterAt = text.slice(lastAtSymbolIndex + 1);
    // Extract everything until the next space or end of string
    const match = /^(\w*)/.exec(textAfterAt);
    return match ? match[0].toLowerCase() : '';
  }, [text]);

  // Update query when text changes
  useEffect(() => {
    if (!isVisible) return;
    
    setMentionQuery(getQueryFromText());
  }, [text, isVisible, getQueryFromText]);

  // Filter users based on the query
  useEffect(() => {
    if (!isVisible) return;
    
    const filtered = users.filter(user => 
      user.username.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      (user.name && user.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    );
    
    setFilteredUsers(filtered.slice(0, 5)); // Limit to 5 suggestions
  }, [mentionQuery, users, isVisible]);

  // Hide suggestions when no matches and not loading
  useEffect(() => {
    if (!isVisible) return;
    
    let timer = null;
    if (filteredUsers.length === 0 && !loading && !error && mentionQuery.length > 0) {
      // Don't hide immediately for better UX - wait a bit to see if user keeps typing
      timer = setTimeout(() => {
        if (filteredUsers.length === 0 && mentionQuery.length > 0) {
          setIsVisible(false);
        }
      }, 1500);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [filteredUsers, loading, isVisible, setIsVisible, error, mentionQuery]);

  // Memoize the list items to prevent rerenders - moved before conditional return
  const suggestionItems = useMemo(() => {
    if (!isVisible) return null;
    
    if (loading) {
      return (
        <ListGroup.Item className="d-flex justify-content-center align-items-center py-3">
          <Spinner animation="border" size="sm" className="me-2" />
          <span>Loading users...</span>
        </ListGroup.Item>
      );
    }
    
    if (error) {
      return <ListGroup.Item className="text-danger">{error}</ListGroup.Item>;
    }
    
    if (filteredUsers.length === 0) {
      return (
        <ListGroup.Item className="text-muted">
          {mentionQuery.length > 0 
            ? `No users matching '${mentionQuery}'` 
            : 'Start typing to search for users'}
        </ListGroup.Item>
      );
    }
    
    return filteredUsers.map(user => (
      <ListGroup.Item 
        key={user.id}
        action
        onClick={() => {
          onSelectUser(user.username);
          setIsVisible(false);
        }}
        className="d-flex align-items-center py-2"
        style={{ cursor: 'pointer' }}
      >
        <div 
          className="bg-primary text-white rounded-circle me-2 d-flex align-items-center justify-content-center flex-shrink-0"
          style={{ width: 28, height: 28, fontSize: '0.9rem' }}
        >
          {user.username ? user.username.charAt(0).toUpperCase() : '?'}
        </div>
        <div className="d-flex flex-column">
          <span className="fw-bold">{user.username}</span>
          {user.name && <small className="text-muted">{user.name}</small>}
        </div>
        {user.is_admin && (
          <span className="badge bg-secondary ms-auto">admin</span>
        )}
      </ListGroup.Item>
    ));
  }, [loading, error, filteredUsers, mentionQuery, onSelectUser, setIsVisible, isVisible]);

  // Don't render if not visible - moved after hooks
  if (!isVisible) return null;

  return (
    <div 
      className="mention-suggestions"
      style={{
        position: 'absolute',
        left: `${position.left}px`,
        top: `${position.top}px`,
        zIndex: 1000,
        width: '250px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        borderRadius: '4px',
        backgroundColor: '#fff',
        border: '1px solid rgba(0,0,0,0.125)',
        transform: 'translateX(-8px)'
      }}
    >
      <div 
        style={{
          position: 'absolute',
          top: '-6px',
          left: '8px',
          width: '12px',
          height: '12px',
          transform: 'rotate(45deg)',
          backgroundColor: '#fff',
          borderLeft: '1px solid rgba(0,0,0,0.125)',
          borderTop: '1px solid rgba(0,0,0,0.125)',
          zIndex: 1001
        }}
      />
      <ListGroup>
        {suggestionItems}
      </ListGroup>
    </div>
  );
};

export default React.memo(MentionSuggestions); 