-- Task 16: add the minimal analyst alert workflow without introducing incident states.
ALTER TABLE alerts DROP CONSTRAINT alerts_status_task15_check;
ALTER TABLE alerts ADD COLUMN status_updated_at timestamptz;
ALTER TABLE alerts ADD COLUMN status_updated_by uuid REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE alerts ADD CONSTRAINT alerts_status_check CHECK (status IN ('NEW','ACKNOWLEDGED'));
CREATE INDEX alerts_status_time_idx ON alerts(status, created_at DESC);
CREATE INDEX alerts_status_actor_idx ON alerts(status_updated_by);
