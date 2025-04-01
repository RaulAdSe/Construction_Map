import React from 'react';
import { ListGroup } from 'react-bootstrap';
import translate from '../utils/translate';

const MapList = ({ maps, selectedMap, onMapSelect }) => {
  if (!maps || maps.length === 0) {
    return (
      <div className="p-3 bg-light rounded">
        <p className="text-center">{translate('No maps available.')}</p>
      </div>
    );
  }

  return (
    <ListGroup>
      {maps.map(map => (
        <ListGroup.Item 
          key={map.id} 
          active={selectedMap && selectedMap.id === map.id}
          onClick={() => onMapSelect(map.id)}
          action
        >
          {map.name}
        </ListGroup.Item>
      ))}
    </ListGroup>
  );
};

export default MapList; 