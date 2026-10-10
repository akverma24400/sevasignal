import React, { useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { MapPin, Building2, Clock3, Phone, Info, ChevronLeft, RefreshCw } from 'lucide-react';
import { useLanguage } from '../i18n';
import { useResource, useNow, statusOf } from '../hooks';
import {
  StatusBadge,
  Loading,
  ErrorPanel,
  ServiceFreshness,
  SampleNotice,
  HistoryList,
  Modal,
  CentreCard,
  DateTime,
} from '../components';
function Alternatives({ centreId, service, onClose }) {
  const { t, name } = useLanguage();
  const { data, error, loading, refresh } = useResource(
    `/centres/${centreId}/alternatives?service=${service.service_id}`,
  );
  return (
    <Modal title={`${t('alternatives')} · ${name(service)}`} onClose={onClose} wide>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorPanel error={error} retry={refresh} />
      ) : data.centres.length ? (
        <div className="alternative-grid">
          {data.centres.map((c) => (
            <div
              key={c.id}
              onClick={(e) => {
                if (e.target.closest('a')) onClose();
              }}
            >
              <CentreCard centre={c} focusService={service.service_id} offset={data.clockOffset} />
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-copy">{t('noAlternatives')}</p>
      )}
    </Modal>
  );
}
export default function CentreDetail() {
  const { id } = useParams();
  const location = useLocation();
  const { t, name } = useLanguage();
  const { data, error, loading, refresh } = useResource(`/centres/${id}`);
  const now = useNow() + (data?.clockOffset || 0);
  const [alternative, setAlternative] = useState(null);
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
        <Link className="text-link" to="/">
          {t('back')}
        </Link>
      </main>
    );
  const centre = data.centre;
  return (
    <main id="main" className="shell detail-page">
      <Link className="back-link" to={location.state?.from || '/'}>
        <ChevronLeft size={18} />
        {t('back')}
      </Link>
      {error && <ErrorPanel error={error} compact retry={refresh} />}
      <section className="detail-heading">
        <span className="centre-symbol large">
          <Building2 size={34} />
        </span>
        <div>
          <div className="title-tags">
            <span className="eyebrow">{centre.city.toUpperCase()}</span>
            {centre.is_demo && <span className="sample-tag">{t('sampleCentre')}</span>}
          </div>
          <h1>{name(centre)}</h1>
          <p className="location">
            <MapPin size={17} />
            {centre.area}, {centre.city} · {centre.pincode}
          </p>
        </div>
      </section>
      {centre.is_demo && <SampleNotice />}
      <div className="detail-layout">
        <div>
          <section className="panel">
            <div className="panel-heading">
              <h2>{t('services')}</h2>
              <button className="refresh-button" onClick={refresh}>
                <RefreshCw size={15} />
                {t('refresh')}
              </button>
            </div>
            <div className="detail-services">
              {centre.services.map((service) => {
                const status = statusOf(service, now);
                return (
                  <article className="detail-service" key={service.id}>
                    <div className="service-main">
                      <div>
                        <span className="category-label">{service.category}</span>
                        <h3>{name(service)}</h3>
                      </div>
                      <StatusBadge status={status} />
                    </div>
                    <ServiceFreshness service={service} offset={data.clockOffset} />
                    {status === 'unavailable' && service.reason && (
                      <p className="service-note">
                        {t('reason')}: {t(service.reason)}
                      </p>
                    )}
                    {status === 'unknown' && (
                      <p className="unknown-hint">
                        <Info size={15} />
                        {t('unknownHelp')}
                      </p>
                    )}
                    {service.note && (
                      <p className="operator-note">
                        <strong>{t('note')}:</strong> {service.note}
                      </p>
                    )}
                    <div className="service-actions">
                      {status !== 'unknown' && (
                        <span className="expiry">
                          {t('expires')}: <DateTime date={service.expires_at} />
                        </span>
                      )}
                      {status !== 'available' && (
                        <button className="text-link" onClick={() => setAlternative(service)}>
                          {t('viewAlternatives')}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
              {!centre.services.length && <p>{t('noServices')}</p>}
            </div>
          </section>
          <section className="panel history-panel">
            <div className="panel-heading">
              <h2>{t('recentUpdates')}</h2>
            </div>
            <HistoryList items={data.history} />
          </section>
        </div>
        <aside>
          <section className="panel contact-panel">
            <h2>{t('contact')}</h2>
            {centre.description && <p className="contact-description">{centre.description}</p>}
            <div className="contact-item">
              <MapPin size={21} />
              <div>
                <h3>{t('address')}</h3>
                <p>{centre.address}</p>
                <p>{centre.pincode}</p>
              </div>
            </div>
            <div className="contact-item">
              <Clock3 size={21} />
              <div>
                <h3>{t('hours')}</h3>
                <p>{centre.opening_hours}</p>
              </div>
            </div>
            <div className="contact-item">
              <Phone size={21} />
              <div>
                <h3>{t('phone')}</h3>
                {centre.phone ? (
                  <a className="text-link" href={`tel:${centre.phone.replace(/[^+\d]/g, '')}`}>
                    {centre.phone}
                  </a>
                ) : (
                  <p>{t('noPhone')}</p>
                )}
              </div>
            </div>
            <p className="contact-note">{t('centreNote')}</p>
          </section>
          <section className="panel legend-panel">
            <h2>{t('legend')}</h2>
            {['available', 'unavailable', 'closed', 'unknown'].map((status) => (
              <div key={status}>
                <StatusBadge status={status} />
                <p>{t(status + 'Help')}</p>
              </div>
            ))}
          </section>
        </aside>
      </div>
      {alternative && (
        <Alternatives centreId={id} service={alternative} onClose={() => setAlternative(null)} />
      )}
    </main>
  );
}
