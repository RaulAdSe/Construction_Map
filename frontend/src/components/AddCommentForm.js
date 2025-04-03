import React, { useState } from 'react';
import { Form, Button, Alert, Spinner } from 'react-bootstrap';
import { addComment } from '../services/eventService';
import MentionInput from './MentionInput';
import translate from '../utils/translate';
import '../assets/styles/AddCommentForm.css';

const AddCommentForm = ({ eventId, onCommentAdded, projectId, isMobile = false }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState([]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError(translate('Please enter a comment'));
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Create FormData for file uploads
      const formData = new FormData();
      formData.append('content', content);
      formData.append('event_id', eventId);
      
      // Add files if any
      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          formData.append('files', files[i]);
        }
      }
      
      const newComment = await addComment(formData);
      
      // Reset form
      setContent('');
      setFiles([]);
      
      // Update parent component
      if (onCommentAdded) {
        onCommentAdded(newComment);
      }
      
    } catch (err) {
      console.error('Error adding comment:', err);
      setError(translate('Failed to add comment. Please try again.'));
    } finally {
      setLoading(false);
    }
  };
  
  const handleFileChange = (e) => {
    if (e.target.files) {
      // Convert FileList to Array and validate
      const fileArray = Array.from(e.target.files);
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      // Check if any file exceeds max size
      const oversizedFiles = fileArray.filter(file => file.size > maxSize);
      if (oversizedFiles.length > 0) {
        setError(translate('Some files exceed the 5MB size limit'));
        return;
      }
      
      // Limit to 3 files
      if (fileArray.length > 3) {
        setError(translate('Maximum 3 files allowed'));
        return;
      }
      
      setFiles(fileArray);
      setError(''); // Clear any previous errors
    }
  };
  
  return (
    <div className={`add-comment-form ${isMobile ? 'mobile-comment-form' : ''}`}>
      <h6 className={`form-title ${isMobile ? 'mb-2 small' : 'mb-3'}`}>
        {translate('Add Comment')}
      </h6>
      
      <Form onSubmit={handleSubmit}>
        <Form.Group className="mb-3">
          <MentionInput
            value={content}
            onChange={setContent}
            placeholder={translate('Write your comment here (use @ to mention users)')}
            rows={isMobile ? 3 : 4}
            projectId={projectId}
            id="comment-input"
            className={isMobile ? 'mobile-textarea' : ''}
          />
        </Form.Group>
        
        <Form.Group className={`mb-3 ${isMobile ? 'small' : ''}`}>
          <Form.Label>{translate('Attach Files (Optional)')}</Form.Label>
          <Form.Control
            type="file"
            onChange={handleFileChange}
            multiple
            className={isMobile ? 'form-control-sm' : ''}
          />
          <Form.Text className="text-muted">
            {translate('Max 3 files, 5MB each. Supported formats: Images, PDF, DOC.')}
          </Form.Text>
        </Form.Group>
        
        {files.length > 0 && (
          <div className={`selected-files ${isMobile ? 'small mb-2' : 'mb-3'}`}>
            <p className="mb-1">{translate('Selected files')}:</p>
            <ul className="list-unstyled">
              {files.map((file, index) => (
                <li key={index} className="selected-file">
                  <i className="bi bi-paperclip me-1"></i>
                  <span>{file.name}</span>
                  <span className="file-size text-muted ms-1">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {error && (
          <Alert variant="danger" className={`${isMobile ? 'py-2 px-3 small mb-2' : 'mb-3'}`}>
            {error}
          </Alert>
        )}
        
        <div className="d-flex justify-content-end">
          <Button 
            variant="primary" 
            type="submit" 
            disabled={loading}
            className={isMobile ? 'btn-sm px-3' : ''}
          >
            {loading ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-1"
                />
                {translate('Posting...')}
              </>
            ) : translate('Post Comment')}
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default AddCommentForm; 