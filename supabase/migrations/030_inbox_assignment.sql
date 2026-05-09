ALTER TABLE customers
  ADD COLUMN inbox_assigned_to uuid REFERENCES admin_users(id),
  ADD COLUMN inbox_assigned_at timestamptz;
