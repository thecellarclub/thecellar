ALTER TABLE customers
  ADD COLUMN inbox_follow_up_date date,
  ADD COLUMN inbox_follow_up_note text,
  ADD COLUMN inbox_follow_up_set_by uuid REFERENCES admin_users(id);
