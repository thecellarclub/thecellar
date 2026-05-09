CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Seed rows are inserted via scripts/seed-admin-users.ts (passwords set there).
-- Do NOT put plaintext passwords in this migration.
INSERT INTO admin_users (email, name, password_hash)
VALUES
  ('daniel@thecellar.club', 'Daniel', '$placeholder_run_seed_script'),
  ('julia@thebothy.club',   'Julia',  '$placeholder_run_seed_script'),
  ('craig@thecellar.club',  'Craig',  '$placeholder_run_seed_script');
