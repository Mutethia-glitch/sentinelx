CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (last_seen_at >= created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions(user_id);
CREATE INDEX auth_sessions_expiry_idx ON auth_sessions(expires_at);

CREATE FUNCTION revoke_user_auth_sessions() RETURNS trigger
LANGUAGE plpgsql AS $function$
BEGIN
  IF (OLD.active AND NOT NEW.active) OR OLD.password_hash IS DISTINCT FROM NEW.password_hash THEN
    UPDATE auth_sessions SET revoked_at = clock_timestamp()
      WHERE user_id = NEW.id AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER users_revoke_auth_sessions
AFTER UPDATE OF active, password_hash ON users
FOR EACH ROW EXECUTE FUNCTION revoke_user_auth_sessions();
