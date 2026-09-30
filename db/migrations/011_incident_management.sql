-- Task 18: add attributable incident assignment/status metadata and terminal notes.
ALTER TABLE incidents ADD COLUMN updated_at timestamptz;
UPDATE incidents SET updated_at=created_at WHERE updated_at IS NULL;
ALTER TABLE incidents ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE incidents ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE incidents ADD COLUMN assignment_updated_at timestamptz;
ALTER TABLE incidents ADD COLUMN assignment_updated_by uuid REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE incidents ADD COLUMN status_updated_at timestamptz;
ALTER TABLE incidents ADD COLUMN status_updated_by uuid REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE incidents ADD COLUMN resolution_note text;
ALTER TABLE incidents ADD COLUMN resolution_at timestamptz;
ALTER TABLE incidents ADD COLUMN resolution_by uuid REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE incidents ADD CONSTRAINT incidents_resolution_note_check CHECK (resolution_note IS NULL OR (btrim(resolution_note)<>'' AND length(resolution_note)<=4000));
ALTER TABLE incidents ADD CONSTRAINT incidents_resolution_metadata_check CHECK ((resolution_note IS NULL AND resolution_at IS NULL AND resolution_by IS NULL) OR (resolution_note IS NOT NULL AND resolution_at IS NOT NULL AND resolution_by IS NOT NULL));
CREATE INDEX incidents_assignment_actor_idx ON incidents(assignment_updated_by);
CREATE INDEX incidents_status_actor_idx ON incidents(status_updated_by);
CREATE INDEX incidents_resolution_actor_idx ON incidents(resolution_by);
