import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus,
  CheckCircle2,
  Clock3,
  AlertCircle,
  LayoutGrid,
  History,
  Building2,
  Settings2,
  Trash2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../api';
import { useLanguage } from '../i18n';
import { useResource, useNow, statusOf, useToast } from '../hooks';
import {
  Loading,
  ErrorPanel,
  StatusBadge,
  ServiceFreshness,
  Modal,
  HistoryList,
  DateTime,
  Empty,
  SampleNotice,
} from '../components';

function StatusForm({ service, defaultTtl, onClose, onSaved }) {
  const { t, name } = useLanguage();
  const toast = useToast();
  const [status, setStatus] = useState(service.reported_status || 'unknown');
  const [reason, setReason] = useState(service.reason || '');
  const [note, setNote] = useState(service.note || '');
  const [ttl, setTtl] = useState(defaultTtl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/operator/services/${service.id}/status`, {
        method: 'PATCH',
        body: { status, reason, note, ttlMinutes: Number(ttl), version: service.version },
      });
      onSaved();
      toast(t('saved'));
    } catch (e) {
      if (e.status === 409) {
        onSaved();
        toast(e.message);
      } else setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={t('statusTitle')} onClose={() => !busy && onClose()}>
      <p className="modal-service-name">{name(service)}</p>
      <p className="muted">{t('statusHelp')}</p>
      <form onSubmit={submit}>
        <fieldset className="status-choices">
          <legend className="sr-only">{t('newStatus')}</legend>
          {['available', 'unavailable', 'closed', 'unknown'].map((s) => (
            <label key={s} className={`status-choice ${status === s ? 'selected' : ''}`}>
              <input
                type="radio"
                name="new-status"
                value={s}
                checked={status === s}
                onChange={() => setStatus(s)}
              />
              <StatusBadge status={s} />
            </label>
          ))}
        </fieldset>
        {status === 'unavailable' && (
          <>
            <label htmlFor="status-reason">{t('reason')}</label>
            <select
              id="status-reason"
              value={reason}
              required
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="">{t('chooseReason')}</option>
              {['network', 'equipment', 'staff', 'scheduled', 'other'].map((r) => (
                <option key={r} value={r}>
                  {t(r)}
                </option>
              ))}
            </select>
          </>
        )}
        {status !== 'unknown' ? (
          <>
            <label htmlFor="status-ttl">{t('validFor')}</label>
            <select id="status-ttl" value={ttl} onChange={(e) => setTtl(e.target.value)}>
              {[...new Set([1, 15, 30, 60, 120, 240, defaultTtl])]
                .sort((a, b) => a - b)
                .map((n) => (
                  <option key={n} value={n}>
                    {n} {t(n === 1 ? 'minute' : 'minutes')}
                  </option>
                ))}
            </select>
          </>
        ) : (
          <p className="info-note">{t('confirmUnknown')}</p>
        )}
        <label htmlFor="status-note">{t('optionalNote')}</label>
        <textarea
          id="status-note"
          maxLength={240}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('notePlaceholder')}
        />
        <div className="character-count">{note.length}/240</div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button outline" disabled={busy} onClick={onClose}>
            {t('cancel')}
          </button>
          <button className="button" disabled={busy}>
            {t(busy ? 'saving' : 'save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AddService({ catalog, centre, onClose, onSaved }) {
  const { t, name } = useLanguage();
  const toast = useToast();
  const [serviceId, setService] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const options = catalog.filter((s) => !centre.services.some((cs) => cs.service_id === s.id));
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/operator/services', { method: 'POST', body: { serviceId } });
      onSaved();
      toast(t('added'));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={t('addTitle')} onClose={() => !busy && onClose()}>
      {options.length ? (
        <form onSubmit={submit}>
          <label htmlFor="new-service">{t('chooseService')}</label>
          <select
            id="new-service"
            required
            value={serviceId}
            onChange={(e) => setService(e.target.value)}
          >
            <option value="">{t('chooseService')}</option>
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {name(s)}
              </option>
            ))}
          </select>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button type="button" className="button outline" onClick={onClose} disabled={busy}>
              {t('cancel')}
            </button>
            <button className="button" disabled={busy}>
              {t(busy ? 'saving' : 'add')}
            </button>
          </div>
        </form>
      ) : (
        <p>{t('allAdded')}</p>
      )}
    </Modal>
  );
}

function RemoveService({ service, onClose, onSaved }) {
  const { t, name } = useLanguage();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    setBusy(true);
    try {
      await api(`/operator/services/${service.id}`, { method: 'DELETE' });
      onSaved();
      toast(t('removed'));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={t('removeTitle')} onClose={() => !busy && onClose()}>
      <strong>{name(service)}</strong>
      <p className="muted">{t('removeHelp')}</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="button outline" disabled={busy} onClick={onClose}>
          {t('cancel')}
        </button>
        <button className="button danger" disabled={busy} onClick={remove}>
          {t('remove')}
        </button>
      </div>
    </Modal>
  );
}

function Profile({ centre, onSaved }) {
  const { t } = useLanguage();
  const toast = useToast();
  const [form, setForm] = useState(() =>
    Object.fromEntries(
      [
        'name',
        'name_hi',
        'area',
        'city',
        'pincode',
        'address',
        'opening_hours',
        'description',
        'phone',
      ].map((k) => [k, centre[k] || '']),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/operator/centre', { method: 'PATCH', body: form });
      toast(t('profileSaved'));
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function changePassword(e) {
    e.preventDefault();
    setPasswordBusy(true);
    setPasswordError('');
    try {
      await api('/auth/password', { method: 'POST', body: passwords });
      setPasswords({ currentPassword: '', newPassword: '' });
      toast(t('passwordSaved'));
    } catch (e) {
      setPasswordError(e.message);
    } finally {
      setPasswordBusy(false);
    }
  }
  const field = (key, label, options = {}) => (
    <div className={options.full ? 'full-span' : ''} key={key}>
      <label htmlFor={`profile-${key}`}>{t(label)}</label>
      <input
        id={`profile-${key}`}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        required={options.required !== false}
        maxLength={options.max || 100}
        {...(key === 'pincode'
          ? { inputMode: 'numeric', pattern: '[1-9][0-9]{5}', maxLength: 6 }
          : key === 'phone'
            ? { type: 'tel' }
            : {})}
      />
    </div>
  );
  return (
    <div className="profile-layout">
      <section className="panel profile-panel">
        <h2>{t('profile')}</h2>
        <form onSubmit={save}>
          <div className="form-grid">
            {field('name', 'centreName')}
            {field('name_hi', 'hindiName', { required: false })}
            {field('area', 'area', { max: 80 })}
            {field('city', 'city', { max: 80 })}
            {field('pincode', 'pincode')}
            {field('phone', 'phone', { required: false, max: 18 })}
            {field('address', 'address', { full: true, max: 240 })}
            {field('opening_hours', 'openingHours', { full: true, max: 120 })}
            <div className="full-span">
              <label htmlFor="profile-description">{t('description')}</label>
              <textarea
                id="profile-description"
                value={form.description}
                rows={3}
                maxLength={400}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button" disabled={busy}>
            {t(busy ? 'saving' : 'save')}
          </button>
        </form>
      </section>
      <section className="panel password-panel">
        <ShieldCheck size={27} />
        <h2>{t('passwordChange')}</h2>
        <form onSubmit={changePassword}>
          <label htmlFor="current-password">{t('currentPassword')}</label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            value={passwords.currentPassword}
            onChange={(e) => setPasswords((f) => ({ ...f, currentPassword: e.target.value }))}
          />
          <label htmlFor="new-password">{t('newPassword')}</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={passwords.newPassword}
            onChange={(e) => setPasswords((f) => ({ ...f, newPassword: e.target.value }))}
          />
          {passwordError && (
            <p className="form-error" role="alert">
              {passwordError}
            </p>
          )}
          <button className="button outline full" disabled={passwordBusy}>
            {t(passwordBusy ? 'saving' : 'savePassword')}
          </button>
        </form>
      </section>
    </div>
  );
}

export default function Dashboard({ config }) {
  const { t, name } = useLanguage();
  const [params, setParams] = useSearchParams();
  const tab = ['services', 'history', 'profile'].includes(params.get('tab'))
    ? params.get('tab')
    : 'services';
  const { data, error, loading, refresh, refreshing } = useResource('/operator/dashboard');
  const now = useNow() + (data?.clockOffset || 0);
  const [modal, setModal] = useState(null);
  const done = () => {
    setModal(null);
    refresh();
  };
  if (loading)
    return (
      <main id="main" className="shell page">
        <Loading />
      </main>
    );
  if (!data)
    return (
      <main id="main" className="shell page">
        <ErrorPanel error={error} retry={refresh} />
      </main>
    );
  const centre = data.centre;
  const available = centre.services.filter((s) => statusOf(s, now) === 'available').length;
  const unknown = centre.services.filter((s) => statusOf(s, now) === 'unknown').length;
  const stats = [
    [CheckCircle2, available, 'fresh', 'green'],
    [Clock3, unknown, 'attention', 'amber'],
    [AlertCircle, data.incidents.filter((i) => !i.resolved_at).length, 'interruptions', 'orange'],
    [LayoutGrid, centre.services.length, 'listed', 'blue'],
  ];
  return (
    <main id="main" className="shell dashboard-page">
      <section className="dashboard-heading">
        <div>
          <p className="eyebrow">{t('workspace')}</p>
          <h1>{name(centre)}</h1>
          <p>{t('manageIntro')}</p>
        </div>
        <Link className="button outline" to={`/centres/${centre.id}`}>
          <ExternalLink size={17} />
          {t('publicPage')}
        </Link>
      </section>
      {centre.is_demo && <SampleNotice />}
      {error && <ErrorPanel compact error={error} retry={refresh} />}
      <section className="stats-grid">
        {stats.map(([Icon, value, label, color]) => (
          <div className="stat-card" key={label}>
            <span className={`stat-icon ${color}`}>
              <Icon size={22} />
            </span>
            <div>
              <strong>{value}</strong>
              <span>{t(label)}</span>
            </div>
          </div>
        ))}
      </section>
      <div className="dashboard-tabs" role="tablist" aria-label="Dashboard sections">
        {[
          ['services', LayoutGrid, 'serviceBoard'],
          ['history', History, 'activity'],
          ['profile', Settings2, 'profile'],
        ].map(([key, Icon, label]) => (
          <button
            role="tab"
            aria-selected={tab === key}
            key={key}
            onClick={() => setParams({ tab: key })}
            className={tab === key ? 'active' : ''}
          >
            <Icon size={18} />
            {t(label)}
          </button>
        ))}
      </div>
      {tab === 'services' && (
        <section className="panel service-board">
          <div className="panel-heading">
            <div>
              <h2>{t('manage')}</h2>
              <p>{t('statusHelp')}</p>
            </div>
            <div className="board-actions">
              <button
                className="icon-button"
                onClick={refresh}
                disabled={refreshing}
                aria-label={t('refresh')}
              >
                <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
              </button>
              <button className="button small" onClick={() => setModal({ type: 'add' })}>
                <Plus size={18} />
                {t('addService')}
              </button>
            </div>
          </div>
          {centre.services.length ? (
            <div className="operator-services">
              {centre.services.map((service) => (
                <article className="operator-service" key={service.id}>
                  <div className="operator-service-info">
                    <span className="category-label">{service.category}</span>
                    <h3>{name(service)}</h3>
                    <ServiceFreshness service={service} offset={data.clockOffset} />
                    {service.note && <p className="service-note">{service.note}</p>}
                  </div>
                  <StatusBadge status={statusOf(service, now)} />
                  <div className="operator-service-actions">
                    <button
                      className="button outline small"
                      onClick={() => setModal({ type: 'status', service })}
                    >
                      {t('updateStatus')}
                    </button>
                    <button
                      className="icon-button delete"
                      aria-label={`${t('remove')} ${name(service)}`}
                      onClick={() => setModal({ type: 'remove', service })}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty title={t('noServices')} description={t('noServicesHelp')} />
          )}
        </section>
      )}
      {tab === 'history' && (
        <div className="activity-layout">
          <section className="panel">
            <div className="panel-heading">
              <h2>{t('reported')}</h2>
            </div>
            <p className="activity-help">{t('historyHelp')}</p>
            {data.incidents.length ? (
              <div className="incident-list">
                {data.incidents.map((i) => (
                  <article className="incident" key={i.id}>
                    <div className="incident-title">
                      <h3>{name(i)}</h3>
                      <span className={`incident-state ${i.resolved_at ? 'resolved' : ''}`}>
                        {t(
                          i.resolved_at
                            ? 'resolved'
                            : statusOf(i, now) === 'unavailable'
                              ? 'ongoing'
                              : 'awaiting',
                        )}
                      </span>
                    </div>
                    <p>
                      {t('reason')}: {t(i.reason)}
                    </p>
                    {i.note && <p>{i.note}</p>}
                    <dl>
                      <div>
                        <dt>{t('started')}</dt>
                        <dd>
                          <DateTime date={i.started_at} />
                        </dd>
                      </div>
                      <div>
                        <dt>{t('restored')}</dt>
                        <dd>{i.resolved_at ? <DateTime date={i.resolved_at} /> : t('awaiting')}</dd>
                      </div>
                    </dl>
                    {i.resolution_note && <p className="resolution-note">{i.resolution_note}</p>}
                  </article>
                ))}
              </div>
            ) : (
              <p className="padded muted">{t('noneIncidents')}</p>
            )}
          </section>
          <section className="panel history-panel">
            <div className="panel-heading">
              <h2>{t('history')}</h2>
            </div>
            <HistoryList items={data.history} />
          </section>
        </div>
      )}
      {tab === 'profile' && <Profile centre={centre} onSaved={refresh} />}{' '}
      {modal?.type === 'status' && (
        <StatusForm
          service={modal.service}
          defaultTtl={config.defaultTtl}
          onClose={() => setModal(null)}
          onSaved={done}
        />
      )}{' '}
      {modal?.type === 'add' && (
        <AddService
          catalog={config.catalog}
          centre={centre}
          onClose={() => setModal(null)}
          onSaved={done}
        />
      )}{' '}
      {modal?.type === 'remove' && (
        <RemoveService service={modal.service} onClose={() => setModal(null)} onSaved={done} />
      )}
    </main>
  );
}
