import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Wifi,
  Search,
  MapPin,
  Clock3,
  CheckCircle2,
  AlertCircle,
  MinusCircle,
  HelpCircle,
  RefreshCw,
  SlidersHorizontal,
  LogOut,
  ShieldCheck,
  X,
  Building2,
  Info,
  Languages,
  ExternalLink,
} from 'lucide-react';
import { useLanguage } from './i18n';
import { useAuth, useToast, useNow, statusOf } from './hooks';
export function Logo() {
  return (
    <Link to="/" className="brand" aria-label="SevaSignal home">
      <span className="brand-symbol">
        <Wifi size={24} />
        <i />
      </span>
      <span>
        Seva<span className="brand-accent">Signal</span>
      </span>
    </Link>
  );
}
export function Layout({ children }) {
  const { t, language, setLanguage } = useLanguage();
  const { operator, logout } = useAuth();
  const toast = useToast();
  const [how, setHow] = useState(false);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="header">
        <div className="shell nav">
          <Logo />
          <nav aria-label="Main navigation">
            <NavLink to="/" end>
              {t('directory')}
            </NavLink>
            <button className="nav-link how-link" onClick={() => setHow(true)}>
              {t('how')}
            </button>
          </nav>
          <div className="nav-actions">
            <button
              className="language-button"
              onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
              aria-label={language === 'en' ? 'Switch to Hindi' : 'Switch to English'}
            >
              <Languages size={18} />
              {language === 'en' ? 'हिंदी' : 'EN'}
            </button>
            <Link className="button small outline" to={operator ? '/operator' : '/login'}>
              <ShieldCheck size={17} />
              {t(operator ? 'dashboard' : 'operator')}
            </Link>
            {operator && (
              <button
                className="icon-button"
                title={t('signOut')}
                aria-label={t('signOut')}
                onClick={() => logout().catch((e) => toast(e.message))}
              >
                <LogOut size={19} />
              </button>
            )}
          </div>
        </div>
      </header>
      {children}
      <footer className="footer shell">
        <div>
          <strong>SevaSignal</strong>
          <span>{t('footer')}</span>
        </div>
        <p>{t('footerNote')}</p>
      </footer>
      {how && (
        <Modal title={t('howTitle')} onClose={() => setHow(false)}>
          {[1, 2, 3].map((i) => (
            <div className="how-step" key={i}>
              <span>{i}</span>
              <div>
                <h3>{t('step' + i)}</h3>
                <p>{t('step' + i + 'Text')}</p>
              </div>
            </div>
          ))}
          <button className="button full" onClick={() => setHow(false)}>
            {t('howClose')}
          </button>
        </Modal>
      )}
    </>
  );
}
const statusIcons = {
  available: CheckCircle2,
  unavailable: AlertCircle,
  closed: MinusCircle,
  unknown: HelpCircle,
};
export function StatusBadge({ status, small = false }) {
  const { t } = useLanguage();
  const Icon = statusIcons[status] || HelpCircle;
  return (
    <span className={`status-badge ${status} ${small ? 'compact' : ''}`}>
      <Icon size={small ? 13 : 15} />
      {t(status)}
    </span>
  );
}
export function RelativeTime({ date, offset = 0 }) {
  const { language, t } = useLanguage();
  const now = useNow() + offset;
  if (!date) return <>{t('notConfirmed')}</>;
  const minutes = Math.floor(Math.max(0, now - Date.parse(date)) / 60000);
  let value;
  if (minutes < 1) value = t('justNow');
  else if (minutes < 60)
    value = new Intl.RelativeTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
      numeric: 'always',
    }).format(-minutes, 'minute');
  else if (minutes < 1440)
    value = new Intl.RelativeTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
      numeric: 'always',
    }).format(-Math.floor(minutes / 60), 'hour');
  else
    value = new Intl.RelativeTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
      numeric: 'always',
    }).format(-Math.floor(minutes / 1440), 'day');
  return (
    <time
      dateTime={date}
      title={new Date(date).toLocaleString(language === 'hi' ? 'hi-IN' : 'en-IN')}
    >
      {value}
    </time>
  );
}
export function DateTime({ date }) {
  const { language } = useLanguage();
  return date ? (
    <time dateTime={date}>
      {new Date(date).toLocaleString(language === 'hi' ? 'hi-IN' : 'en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })}
    </time>
  ) : (
    <span>—</span>
  );
}
export function Loading({ text }) {
  return (
    <div className="loading" role="status">
      <RefreshCw size={23} className="spin" />
      <span>{text || 'Loading…'}</span>
    </div>
  );
}
export function ErrorPanel({ error, retry, compact = false }) {
  const { t } = useLanguage();
  return (
    <div className={`error-panel ${compact ? 'compact' : ''}`} role="alert">
      <AlertCircle size={24} />
      <div>
        <strong>{t('errorTitle')}</strong>
        <p>{error?.message}</p>
      </div>
      {retry && (
        <button className="button outline small" onClick={retry}>
          {t('retry')}
        </button>
      )}
    </div>
  );
}
export function Empty({ title, description, action }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Search size={31} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function SampleNotice() {
  const { t } = useLanguage();
  return (
    <div className="sample-notice">
      <Info size={16} />
      <span>
        <strong>{t('sample')}.</strong> {t('sampleNote')}
      </span>
    </div>
  );
}
export function CentreCard({ centre, offset = 0, focusService }) {
  const { t, name } = useLanguage();
  const now = useNow() + offset;
  const location = useLocation();
  const services = [...centre.services].sort(
    (a, b) => Number(b.service_id === focusService) - Number(a.service_id === focusService),
  );
  const available = centre.services.filter((s) => statusOf(s, now) === 'available').length;
  return (
    <article className="centre-card">
      <div className="centre-card-top">
        <span className="centre-symbol">
          <Building2 size={24} />
        </span>
        {centre.is_demo && <span className="sample-tag">{t('sampleCentre')}</span>}
      </div>
      <Link
        className="card-title"
        to={`/centres/${centre.id}`}
        state={{ from: location.pathname + location.search }}
      >
        <h2>{name(centre)}</h2>
      </Link>
      <p className="location">
        <MapPin size={15} />
        {centre.area}, {centre.city} <span>· {centre.pincode}</span>
      </p>
      <div className="card-divider" />
      <div className="card-services">
        {services.slice(0, 3).map((service) => (
          <div className="card-service" key={service.id}>
            <span>{name(service)}</span>
            <StatusBadge small status={statusOf(service, now)} />
          </div>
        ))}
        {services.length === 0 && <p className="muted">{t('noServices')}</p>}
      </div>
      <div className="card-bottom">
        <span className="card-availability">
          <span className="tiny-dot" />
          {available}/{services.length} {t('available').toLowerCase()}
        </span>
        <Link
          to={`/centres/${centre.id}`}
          state={{ from: location.pathname + location.search }}
          className="text-link"
        >
          {t('details')}
        </Link>
      </div>
    </article>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = old;
      el.close();
    };
  }, []);
  return (
    <dialog
      className={`modal ${wide ? 'wide' : ''}`}
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = e.target.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close">
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ServiceFreshness({ service, offset = 0 }) {
  const { t } = useLanguage();
  const now = useNow() + offset;
  const stale = service.expires_at && Date.parse(service.expires_at) <= now;
  return (
    <span className={`freshness ${stale ? 'stale' : ''}`}>
      <Clock3 size={14} />
      {stale ? t('expired') : service.confirmed_at ? t('lastConfirmed') : t('notConfirmed')}
      {service.confirmed_at && (
        <>
          {' '}
          · <RelativeTime date={service.confirmed_at} offset={offset} />
        </>
      )}
    </span>
  );
}
export function HistoryList({ items }) {
  const { t, name } = useLanguage();
  return items.length ? (
    <div className="history-list">
      {items.map((item) => (
        <div className="history-event" key={item.id}>
          <span className={`event-dot ${item.new_status}`} />
          <div>
            <strong>{name(item)}</strong>
            <div className="history-status">
              <StatusBadge small status={item.new_status} />
              <DateTime date={item.created_at} />
            </div>
            {item.note && <p>{item.note}</p>}
          </div>
        </div>
      ))}
    </div>
  ) : (
    <p className="muted">{t('noHistory')}</p>
  );
}
