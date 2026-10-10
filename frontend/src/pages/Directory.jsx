import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  Clock3,
  RefreshCw,
  MapPin,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { useLanguage } from '../i18n';
import { useResource } from '../hooks';
import { CentreCard, Loading, ErrorPanel, Empty, SampleNotice, StatusBadge } from '../components';
const read = (p) => ({
  q: p.get('q') || '',
  city: p.get('city') || '',
  service: p.get('service') || '',
  status: p.get('status') || '',
  page: p.get('page') || '1',
});
export default function Directory({ config }) {
  const { t, name } = useLanguage();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(() => read(params));
  const [showFilters, setShowFilters] = useState(false);
  useEffect(() => setFilters(read(params)), [params]);
  const query = params.toString();
  const { data, error, loading, refreshing, refresh } = useResource(
    '/centres' + (query ? '?' + query : ''),
  );
  function apply(patch = {}) {
    const next = { ...filters, page: '1', ...patch };
    setFilters(next);
    setParams(
      Object.fromEntries(
        Object.entries(next).filter(([key, v]) => v && (key !== 'page' || v !== '1')),
      ),
    );
  }
  const clear = () => {
    setFilters(read(new URLSearchParams()));
    setParams({});
  };
  return (
    <main id="main" className="shell directory">
      <section className="directory-intro">
        <div>
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1>
            {t('headline')
              .split('\n')
              .map((line, i) => (
                <React.Fragment key={line}>
                  {i > 0 && <br />}
                  {line}
                </React.Fragment>
              ))}
          </h1>
          <p className="intro-copy">{t('intro')}</p>
        </div>
        <div className="intro-aside">
          <span className="intro-signal">
            <CheckCircle2 size={27} />
          </span>
          <strong>{t('aboutFresh')}</strong>
          <p>{t('liveNote')}</p>
        </div>
      </section>
      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <div className="search-field">
          <label htmlFor="directory-search">{t('searchLabel')}</label>
          <div>
            <Search size={20} />
            <input
              id="directory-search"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              maxLength={100}
              placeholder={t('searchPlaceholder')}
            />
          </div>
        </div>
        <div className="search-select">
          <label htmlFor="service-filter">{t('serviceLabel')}</label>
          <select
            id="service-filter"
            value={filters.service}
            onChange={(e) => setFilters((f) => ({ ...f, service: e.target.value }))}
          >
            <option value="">{t('allServices')}</option>
            {config.catalog.map((s) => (
              <option key={s.id} value={s.id}>
                {name(s)}
              </option>
            ))}
          </select>
        </div>
        <button className="button search-submit" type="submit">
          <Search size={18} />
          {t('search')}
        </button>
      </form>
      <SampleNotice />
      <div className="directory-grid">
        <aside className={`filter-sidebar ${showFilters ? 'expanded' : ''}`}>
          <div className="sidebar-title">
            <SlidersHorizontal size={19} />
            <h2>{t('filters')}</h2>
          </div>
          <label className="field-label" htmlFor="city-filter">
            {t('city')}
          </label>
          <select
            id="city-filter"
            value={filters.city}
            onChange={(e) => apply({ city: e.target.value })}
          >
            <option value="">{t('allCities')}</option>
            {config.cities.map((city) => (
              <option key={city}>{city}</option>
            ))}
          </select>
          <div className="sidebar-rule" />
          <h3>{t('availability')}</h3>
          <div className="radio-list">
            {['', 'available', 'unavailable', 'closed', 'unknown'].map((status) => (
              <label key={status}>
                <input
                  type="radio"
                  name="availability"
                  checked={filters.status === status}
                  onChange={() => apply({ status })}
                />
                {status ? <StatusBadge status={status} small /> : <span>{t('all')}</span>}
              </label>
            ))}
          </div>
          <button className="clear-button" onClick={clear}>
            {t('clear')}
          </button>
          <div className="fresh-card">
            <Clock3 size={24} />
            <h3>{t('aboutFresh')}</h3>
            <p>{t('aboutFreshText')}</p>
          </div>
        </aside>
        <section className="results">
          <div className="results-heading">
            <h2>
              {data
                ? `${data.total} ${t(data.total === 1 ? 'oneResult' : 'results')}`
                : t('directory')}
            </h2>
            <div>
              <button
                className="icon-button mobile-filter"
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
                aria-label={t('filters')}
              >
                <SlidersHorizontal size={19} />
              </button>
              <button className="refresh-button" onClick={refresh} disabled={refreshing}>
                <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
                {t(refreshing ? 'refreshing' : 'refresh')}
              </button>
            </div>
          </div>
          {error && <ErrorPanel error={error} retry={refresh} compact />}
          {loading ? (
            <Loading text={t('loading')} />
          ) : data?.centres.length ? (
            <>
              <div className="centre-grid">
                {data.centres.map((c) => (
                  <CentreCard
                    key={c.id}
                    centre={c}
                    offset={data.clockOffset}
                    focusService={filters.service}
                  />
                ))}
              </div>
              {data.total > data.pageSize && (
                <div className="pagination">
                  <button
                    className="button outline small"
                    disabled={data.page <= 1}
                    onClick={() => apply({ page: String(data.page - 1) })}
                  >
                    {t('previous')}
                  </button>
                  <span>
                    {t('page')} {data.page} / {Math.ceil(data.total / data.pageSize)}
                  </span>
                  <button
                    className="button outline small"
                    disabled={data.page * data.pageSize >= data.total}
                    onClick={() => apply({ page: String(data.page + 1) })}
                  >
                    {t('next')}
                  </button>
                </div>
              )}
            </>
          ) : (
            !error && (
              <Empty
                title={t('noCentres')}
                description={t('noCentresHelp')}
                action={
                  <button className="button outline" onClick={clear}>
                    {t('clear')}
                  </button>
                }
              />
            )
          )}
          <p className="results-note">
            <HelpCircle size={16} />
            {t('liveNote')}
          </p>
        </section>
      </div>
    </main>
  );
}
