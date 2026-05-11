import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { getApiBaseUrl } from './utils/apiBase';

if (import.meta.env.PROD && !getApiBaseUrl()) {
  console.error(
    'Missing VITE_API_URL: set it in Vercel to your Render API origin (e.g. https://your-api.onrender.com).'
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
