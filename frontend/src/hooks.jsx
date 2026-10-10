import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api } from './api';
export function useResource(path, interval = 30000) {
  const [state, setState] = useState({ data: null, error: null, loading: true, refreshing: false });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    let controller;
    setState({ data: null, error: null, loading: true, refreshing: false });
    async function load() {
      controller?.abort();
      controller = new AbortController();
      setState((s) => ({ ...s, refreshing: true }));
      try {
        const data = await api(path, { signal: controller.signal });
        if (active)
          setState({
            data: {
              ...data,
              clockOffset: data.serverTime ? Date.parse(data.serverTime) - Date.now() : 0,
            },
            error: null,
            loading: false,
            refreshing: false,
          });
      } catch (error) {
        if (active && error.name !== 'AbortError')
          setState((s) => ({ ...s, error, loading: false, refreshing: false }));
      }
    }
    load();
    const timer = interval
      ? setInterval(() => {
          if (!document.hidden) load();
        }, interval)
      : null;
    const visibility = () => {
      if (!document.hidden) load();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      active = false;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [path, revision, interval]);
  return { ...state, refresh };
}
const Clock = createContext(Date.now());
export function ClockProvider({ children }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <Clock.Provider value={now}>{children}</Clock.Provider>;
}
export const useNow = () => useContext(Clock);
const Auth = createContext();
export function AuthProvider({ children }) {
  const [operator, setOperator] = useState(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api('/auth/me')
      .then((r) => active && setOperator(r.operator))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    const expired = () => setOperator(null);
    window.addEventListener('sevasignal:session-expired', expired);
    return () => {
      active = false;
      window.removeEventListener('sevasignal:session-expired', expired);
    };
  }, []);
  const login = async (email, password) => {
    const r = await api('/auth/login', { method: 'POST', body: { email, password } });
    setOperator(r.operator);
  };
  const logout = async () => {
    await api('/auth/logout', { method: 'POST', body: {} });
    setOperator(null);
  };
  return <Auth.Provider value={{ operator, loading, login, logout }}>{children}</Auth.Provider>;
}
export const useAuth = () => useContext(Auth);
const Toast = createContext();
export function ToastProvider({ children }) {
  const [message, setMessage] = useState('');
  const timer = useRef();
  const toast = useCallback((value) => {
    setMessage(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), 6000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <Toast.Provider value={toast}>
      {children}
      {message && (
        <div className="toast" role="status">
          {message}
          <button onClick={() => setMessage('')} aria-label="Dismiss notification">
            ×
          </button>
        </div>
      )}
    </Toast.Provider>
  );
}
export const useToast = () => useContext(Toast);
export function statusOf(service, now) {
  return service.reported_status === 'unknown' ||
    !service.confirmed_at ||
    !service.expires_at ||
    Date.parse(service.expires_at) <= now
    ? 'unknown'
    : service.reported_status;
}
