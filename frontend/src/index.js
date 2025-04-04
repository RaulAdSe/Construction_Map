import React from 'react';
import ReactDOM from 'react-dom/client';
import './assets/styles/index.css';
import './styles/global.css';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 