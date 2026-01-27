import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tokens.css'; // 新版设计 Tokens
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
