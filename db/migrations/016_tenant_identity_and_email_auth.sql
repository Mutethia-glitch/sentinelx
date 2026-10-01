-- Task 41: isolated-tenant identity, email 2FA challenges, and company-managed user invitations.
-- One SentinelX application database belongs to exactly one company deployment.
CREATE TABLE tenant_profile (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  tenant_id uuid NOT NULL UNIQUE,
  company_name text NOT NULL CHECK (btrim(company_name) <> '' AND length(company_name) <= 120),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_email_challenges (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  purpose text NOT NULL CHECK (purpose = 'LOGIN'),
  code_digest text NOT NULL CHECK (code_digest ~ '^[0-9a-f]{64}$'),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (consumed_at IS NULL OR consumed_at >= created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);
CREATE INDEX auth_email_challenges_user_time_idx
  ON auth_email_challenges(user_id, created_at DESC);

CREATE TABLE user_invitations (
  id uuid PRIMARY KEY,
  email text NOT NULL CHECK (btrim(email) <> '' AND length(email) <= 254),
  display_name text NOT NULL CHECK (btrim(display_name) <> '' AND length(display_name) <= 120),
  role_name text NOT NULL CHECK (role_name IN ('Administrator','Security Analyst','Viewer/Management')),
  code_digest text NOT NULL CHECK (code_digest ~ '^[0-9a-f]{64}$'),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (btrim(reason) <> '' AND length(reason) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (consumed_at IS NULL OR consumed_at >= created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);
CREATE INDEX user_invitations_email_time_idx
  ON user_invitations(lower(email), created_at DESC);
CREATE INDEX user_invitations_creator_time_idx
  ON user_invitations(created_by, created_at DESC);
