import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import App from './App';
import { StoreProvider } from './lib/store';
import './styles.css';
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="empty">
        <h1>Something interrupted this view.</h1>
        <p>Your saved records are still on this device. Reload to try again.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Reload Batchlight
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
const Router = import.meta.env.VITE_STATIC_DEMO === 'true' ? HashRouter : BrowserRouter;
ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <Router>
      <StoreProvider>
        <App />
      </StoreProvider>
    </Router>
  </ErrorBoundary>,
);
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
