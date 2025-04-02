import React, { useState, useEffect } from 'react';
import { Modal, Button, Table, Badge, Spinner, Alert } from 'react-bootstrap';
import { format } from 'date-fns';
import api from '../api';
import translate from '../utils/translate';

const EventHistoryModal = ({ show, onHide, eventId, eventTitle }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch history data when modal is opened
  useEffect(() => {
    if (show && eventId) {
      fetchEventHistory(eventId);
    }
  }, [show, eventId]);

  const fetchEventHistory = async (id) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/events/${id}/history`);
      setHistory(response.data || []);
    } catch (err) {
      console.error("Error fetching event history:", err);
      setError(translate("Failed to load event history."));
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get a badge for different action types
  const getActionBadge = (actionType) => {
    switch(actionType) {
      case 'create':
        return <Badge bg="success">{translate("Created")}</Badge>;
      case 'status_change':
        return <Badge bg="primary">{translate("Status Change")}</Badge>;
      case 'type_change':
        return <Badge bg="info">{translate("Type Change")}</Badge>;
      case 'comment':
        return <Badge bg="secondary">{translate("Comment")}</Badge>;
      case 'edit':
        return <Badge bg="warning">{translate("Edit")}</Badge>;
      default:
        return <Badge bg="secondary">{actionType}</Badge>;
    }
  };

  // Helper function to format action description
  const formatActionDescription = (item) => {
    switch(item.action_type) {
      case 'create':
        return translate("Created event with status: ") + item.new_value;
      case 'status_change':
        return `${translate("Changed status from ")} "${item.previous_value}" ${translate("to")} "${item.new_value}"`;
      case 'type_change':
        return `${translate("Changed type from ")} "${item.previous_value}" ${translate("to")} "${item.new_value}"`;
      case 'comment':
        return `${translate("Added comment")}: "${item.new_value}"`;
      case 'edit':
        if (item.additional_data && item.additional_data.updated_fields) {
          const fields = item.additional_data.updated_fields.join(', ');
          return `${translate("Edited fields")}: ${fields}`;
        }
        return translate("Edited event");
      default:
        return item.action_type;
    }
  };

  // Helper function to create a link to a comment
  const getCommentLink = (item) => {
    if (item.action_type === 'comment' && item.additional_data && item.additional_data.comment_id) {
      const commentId = item.additional_data.comment_id;
      return (
        <Button 
          variant="link" 
          className="p-0 ms-2"
          onClick={() => onCommentClick(eventId, commentId)}
        >
          {translate("View Comment")}
        </Button>
      );
    }
    return null;
  };

  // Handle clicking on a comment link
  const onCommentClick = (eventId, commentId) => {
    onHide();
    // Create a URL with the event and comment IDs
    const url = `/project?event=${eventId}&comment=${commentId}`;
    window.location.href = url;
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      centered
      backdrop="static"
    >
      <Modal.Header closeButton>
        <Modal.Title>
          {translate("Event History")}: {eventTitle || `#${eventId}`}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        
        {loading ? (
          <div className="text-center p-4">
            <Spinner animation="border" />
            <p className="mt-2">{translate("Loading history...")}</p>
          </div>
        ) : history.length === 0 ? (
          <p className="text-center text-muted p-3">
            {translate("No history records found for this event.")}
          </p>
        ) : (
          <Table striped hover responsive>
            <thead>
              <tr>
                <th>{translate("Action")}</th>
                <th>{translate("Description")}</th>
                <th>{translate("User")}</th>
                <th>{translate("Date & Time")}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{getActionBadge(item.action_type)}</td>
                  <td>
                    {formatActionDescription(item)}
                    {getCommentLink(item)}
                  </td>
                  <td>{item.username || `User #${item.user_id}`}</td>
                  <td>{format(new Date(item.created_at), 'PPpp')}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          {translate("Close")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default EventHistoryModal; 