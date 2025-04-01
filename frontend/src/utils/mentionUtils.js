import React from 'react';

/**
 * Parse text and highlight @mentions
 * @param {string} text - The text to parse for mentions
 * @returns {Array} Array of text and highlighted mentions elements
 */
export const parseAndHighlightMentions = (text) => {
  if (!text) return [];
  
  // Regular expression to match @username
  const regex = /(@\w+)/g;
  const parts = text.split(regex);
  
  return parts.map((part, index) => {
    // Check if this part is a mention
    if (part.match(regex)) {
      return (
        <span key={index} className="mention-highlight" style={{ fontWeight: 'bold', color: '#0d6efd' }}>
          {part}
        </span>
      );
    }
    return part;
  });
};

/**
 * Extract list of usernames from text that were mentioned with @
 * @param {string} text - The text to extract mentions from
 * @returns {Array} Array of mentioned usernames (without @ symbol)
 */
export const extractMentions = (text) => {
  if (!text) return [];
  
  const regex = /@(\w+)/g;
  const mentions = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    mentions.push(match[1]); // Capture the username without @
  }
  
  return mentions;
};

/**
 * Insert username at cursor position in textarea
 * @param {HTMLTextAreaElement} textarea - The textarea element
 * @param {string} username - Username to insert with @ prefix
 */
export const insertMention = (textarea, username) => {
  if (!textarea) return;
  
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const mention = `@${username} `;
  
  // Insert the mention at cursor position
  textarea.value = text.substring(0, start) + mention + text.substring(end);
  
  // Place cursor after the inserted mention
  const newCursorPos = start + mention.length;
  textarea.setSelectionRange(newCursorPos, newCursorPos);
  textarea.focus();
};

/**
 * Create a controlled input handler that supports mentions
 * @param {function} setValue - State setter function for input value
 * @returns {function} Event handler for input changes
 */
export const createMentionInputHandler = (setValue) => {
  return (e) => {
    const value = e.target.value;
    setValue(value);
    
    // You can add additional logic here like triggering 
    // suggestions when user types @
  };
}; 