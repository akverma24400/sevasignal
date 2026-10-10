CREATE TABLE centres (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_hi TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL,
  city TEXT NOT NULL,
  pincode VARCHAR(6) NOT NULL CHECK (pincode ~ '^[1-9][0-9]{5}$'),
  address TEXT NOT NULL,
  opening_hours TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE service_catalog (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, name_hi TEXT NOT NULL, category TEXT NOT NULL
);
CREATE TABLE operators (
  id UUID PRIMARY KEY,
  centre_id TEXT NOT NULL REFERENCES centres(id),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE sessions (
  token_hash CHAR(64) PRIMARY KEY,
  operator_id UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE centre_services (
  id UUID PRIMARY KEY,
  centre_id TEXT NOT NULL REFERENCES centres(id),
  service_id TEXT NOT NULL REFERENCES service_catalog(id),
  reported_status TEXT NOT NULL DEFAULT 'unknown' CHECK (reported_status IN ('available','unavailable','closed','unknown')),
  reason TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  confirmed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(centre_id,service_id)
);
CREATE INDEX centre_services_centre ON centre_services(centre_id);
CREATE INDEX centre_services_catalog ON centre_services(service_id,active);
CREATE INDEX centre_services_expiry ON centre_services(expires_at);
CREATE INDEX centres_location ON centres(city,pincode);
CREATE TABLE status_events (
  id UUID PRIMARY KEY,
  centre_service_id UUID NOT NULL REFERENCES centre_services(id),
  operator_id UUID REFERENCES operators(id),
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX events_service_time ON status_events(centre_service_id,created_at DESC);
CREATE TABLE incidents (
  id UUID PRIMARY KEY,
  centre_service_id UUID NOT NULL REFERENCES centre_services(id),
  reason TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX one_open_incident ON incidents(centre_service_id) WHERE resolved_at IS NULL;
