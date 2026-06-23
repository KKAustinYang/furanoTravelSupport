import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { initEngageLabPush } from './lib/engagelab.js';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// EngageLab WebPush 初期化(本番=HTTPS のみ有効。SDK 内部で通知許可を要求)
initEngageLabPush();
