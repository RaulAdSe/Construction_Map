import React from 'react';
import { Card, Badge } from 'react-bootstrap';
import { formatDate } from '../utils/dateUtils';
import translate from '../utils/translate';
import '../assets/styles/CommentList.css';

const CommentList = ({ comments = [], isMobile = false }) => {
  if (!comments || comments.length === 0) {
    return (
      <div className={`no-comments ${isMobile ? 'text-center py-3' : 'text-center py-4'}`}>
        <p className={`text-muted mb-0 ${isMobile ? 'small' : ''}`}>
          {translate('No comments yet. Be the first to comment!')}
        </p>
      </div>
    );
  }

  return (
    <div className={`comment-list ${isMobile ? 'mobile-comment-list' : ''}`}>
      <h6 className={`comments-header ${isMobile ? 'mb-2 small' : 'mb-3'}`}>
        {translate('Comments')} ({comments.length})
      </h6>
      
      {comments.map((comment, index) => (
        <Card 
          key={comment.id || index} 
          className={`comment-card ${isMobile ? 'mb-2 mobile-comment' : 'mb-3'}`}
        >
          <Card.Body className={isMobile ? 'p-2' : 'p-3'}>
            <div className="d-flex justify-content-between align-items-top mb-2">
              <div className="comment-author">
                <span className={`author-name ${isMobile ? 'small fw-bold' : 'fw-bold'}`}>
                  {comment.user_name || translate('Anonymous')}
                </span>
                {comment.user_role && (
                  <Badge 
                    bg="secondary" 
                    className={`ms-2 ${isMobile ? 'mobile-badge' : ''}`}
                  >
                    {comment.user_role}
                  </Badge>
                )}
              </div>
              <div className={`comment-date text-muted ${isMobile ? 'small' : ''}`}>
                {formatDate(comment.created_at)}
              </div>
            </div>
            
            <div className={`comment-content ${isMobile ? 'small' : ''}`}>
              {comment.content}
            </div>
            
            {comment.attachments && comment.attachments.length > 0 && (
              <div className={`comment-attachments ${isMobile ? 'mt-2' : 'mt-3'}`}>
                <h6 className={`${isMobile ? 'small mb-1' : 'mb-2'}`}>
                  {translate('Attachments')}:
                </h6>
                <div className="d-flex flex-wrap">
                  {comment.attachments.map((attachment, i) => (
                    <a 
                      key={i} 
                      href={attachment.url} 
                      target="_blank" 
                      rel="noreferrer" 
                      className={`attachment-link ${isMobile ? 'mobile-attachment small' : ''}`}
                    >
                      <i className="bi bi-paperclip me-1"></i>
                      {attachment.filename || `${translate('Attachment')} ${i + 1}`}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </Card.Body>
        </Card>
      ))}
    </div>
  );
};

export default CommentList; 