-- Resource IDs and non-secret progress only; no provider credentials or DB URLs.
CREATE TABLE tenant_provisioning (
 tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE RESTRICT,
 fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
 stage text NOT NULL CHECK (stage IN ('NEW','CREATING_DATABASE','DATABASE_CREATED','DATABASE_READY','CREATING_SERVICE','SERVICE_CREATED','DEPLOYING','WAITING_HTTPS','READY','REVIEW_REQUIRED')),
 project_id text,
 branch_id text,
 service_id text,
 render_url text,
 updated_at timestamptz NOT NULL DEFAULT now()
);
