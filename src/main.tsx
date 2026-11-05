import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// No StrictMode: the app owns a single WebGL context and game loop, and a
// double-invoked mount would create and dispose a second renderer.
createRoot(document.getElementById('root')!).render(<App />);
