import ReactDOM from 'react-dom/client';
import App from './App';
import './shared/styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing root element');

async function bootstrap(container: HTMLElement) {
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    const { startMocks } = await import('./shared/mocks/browser');
    await startMocks();
  }
  ReactDOM.createRoot(container).render(<App />);
}

void bootstrap(rootElement);
