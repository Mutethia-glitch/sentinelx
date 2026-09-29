INSERT INTO roles(name) VALUES
  ('Administrator'),
  ('Security Analyst'),
  ('Viewer/Management')
ON CONFLICT (name) DO NOTHING;
