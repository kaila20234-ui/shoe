import ReactDOM from 'react-dom/client';
import App from './App';
import './shared/styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing root element');

ReactDOM.createRoot(rootElement).render(<App />);
