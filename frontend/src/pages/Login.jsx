import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, Eye, EyeOff, Wifi } from 'lucide-react';
import { useAuth } from '../hooks';
import { useLanguage } from '../i18n';
export default function Login({ config }) {
  const { operator, login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (operator) return <Navigate to="/operator" replace />;
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email.trim().toLowerCase(), password);
      navigate('/operator');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="shell login-page">
      <div className="login-story">
        <span className="login-emblem">
          <Wifi size={47} />
        </span>
        <p className="eyebrow">SevaSignal · {t('operator')}</p>
        <h1>{t('loginPanel')}</h1>
        <p>{t('loginPanelText')}</p>
        <div className="story-point">
          <CheckCircle2 size={21} />
          {t('step2')}
        </div>
        <div className="story-point">
          <CheckCircle2 size={21} />
          {t('aboutFresh')}
        </div>
      </div>
      <section className="login-form-panel">
        <span className="login-shield">
          <ShieldCheck size={29} />
        </span>
        <h2>{t('welcome')}</h2>
        <p>{t('loginIntro')}</p>
        <form onSubmit={submit}>
          <label htmlFor="email">{t('email')}</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <label htmlFor="password">{t('password')}</label>
          <div className="password-field">
            <input
              id="password"
              type={show ? 'text' : 'password'}
              value={password}
              autoComplete="current-password"
              required
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              aria-label={show ? 'Hide password' : 'Show password'}
              onClick={() => setShow((v) => !v)}
            >
              {show ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="button full" disabled={busy}>
            {t(busy ? 'signingIn' : 'signIn')}
          </button>
        </form>
        {config.showDemoHelp && (
          <details className="demo-help" open>
            <summary>{t('demoAccess')}</summary>
            <label htmlFor="demo-account">{t('demoChoose')}</label>
            <select id="demo-account" defaultValue="" onChange={(e) => setEmail(e.target.value)}>
              <option value="">—</option>
              <option value="roorkee@sevasignal.demo">Roorkee · Civil Lines</option>
              <option value="dehradun@sevasignal.demo">Dehradun · Rajpur Road</option>
              <option value="haridwar@sevasignal.demo">Haridwar · Jwalapur</option>
            </select>
            <p>
              {t('demoPassword')}: <code>SevaDemo2026!</code>
            </p>
            <small>{t('demoPasswordHint')}</small>
          </details>
        )}
      </section>
    </main>
  );
}
