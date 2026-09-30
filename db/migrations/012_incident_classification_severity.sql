-- Task 19: attribute controlled incident classification/severity adjustments.
ALTER TABLE incidents ADD COLUMN assessment_updated_at timestamptz;
ALTER TABLE incidents ADD COLUMN assessment_updated_by uuid REFERENCES users(id) ON DELETE RESTRICT;
CREATE INDEX incidents_assessment_actor_idx ON incidents(assessment_updated_by);
