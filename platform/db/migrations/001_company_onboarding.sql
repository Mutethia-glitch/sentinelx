CREATE TABLE tenants (
  id uuid PRIMARY KEY,
  company_name text NOT NULL CHECK (btrim(company_name) <> '' AND length(company_name) <= 120),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'),
  admin_email text NOT NULL CHECK (btrim(admin_email) <> '' AND length(admin_email) <= 254),
  status text NOT NULL CHECK (status IN ('PENDING_EMAIL','VERIFIED','ACTIVE','FAILED')),
  origin text,
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  activated_at timestamptz
);
CREATE INDEX tenants_status_time_idx ON tenants(status,created_at DESC);

CREATE TABLE company_signups (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE RESTRICT,
  admin_name text NOT NULL CHECK (btrim(admin_name) <> '' AND length(admin_name) <= 120),
  admin_password_hash text CHECK (admin_password_hash IS NULL OR btrim(admin_password_hash) <> ''),
  code_digest text CHECK (code_digest IS NULL OR code_digest ~ '^[0-9a-f]{64}$'),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  sent_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);
CREATE INDEX company_signups_tenant_idx ON company_signups(tenant_id);
