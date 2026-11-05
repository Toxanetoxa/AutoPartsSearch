import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createAppStore } from './store/store';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={createAppStore()}>
      <App />
    </Provider>
  </StrictMode>,
);
