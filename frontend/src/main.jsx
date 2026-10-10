import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { LanguageProvider, useLanguage } from './i18n';
import { AuthProvider, ClockProvider, ToastProvider, useAuth, useResource } from './hooks';
import { Layout, Loading, ErrorPanel, Empty } from './components';
import Directory from './pages/Directory';
import CentreDetail from './pages/CentreDetail';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import '@fontsource-variable/inter';
import '@fontsource-variable/noto-sans-devanagari';
import './styles.css';
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <main className="shell page">
          <h1>Something went wrong.</h1>
          <p>Please reload the page to try again.</p>
          <button className="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </main>
      );
    return this.props.children;
  }
}
function Protected({ children }) {
  const { operator, loading } = useAuth();
  const { t } = useLanguage();
  return loading ? (
    <main id="main" className="shell page">
      <Loading text={t('sessionLoading')} />
    </main>
  ) : operator ? (
    children
  ) : (
    <Navigate to="/login" replace />
  );
}
function App() {
  const config = useResource('/config', 0);
  const location = useLocation();
  const { t } = useLanguage();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.title = `${location.pathname.startsWith('/operator') ? 'Operator dashboard' : location.pathname === '/login' ? 'Operator sign in' : location.pathname.startsWith('/centres/') ? 'Centre details' : 'Find a centre'} · SevaSignal`;
  }, [location.pathname]);
  return (
    <Layout>
      {config.loading ? (
        <main id="main" className="shell page">
          <Loading />
        </main>
      ) : config.error ? (
        <main id="main" className="shell page">
          <ErrorPanel error={config.error} retry={config.refresh} />
        </main>
      ) : (
        <Routes>
          <Route path="/" element={<Directory config={config.data} />} />
          <Route path="/centres/:id" element={<CentreDetail />} />
          <Route path="/login" element={<Login config={config.data} />} />
          <Route
            path="/operator"
            element={
              <Protected>
                <Dashboard config={config.data} />
              </Protected>
            }
          />
          <Route
            path="*"
            element={
              <main id="main" className="shell page">
                <Empty
                  title={t('pageMissing')}
                  action={
                    <Link className="button" to="/">
                      {t('goHome')}
                    </Link>
                  }
                />
              </main>
            }
          />
        </Routes>
      )}
    </Layout>
  );
}
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <LanguageProvider>
          <ClockProvider>
            <ToastProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </ToastProvider>
          </ClockProvider>
        </LanguageProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
