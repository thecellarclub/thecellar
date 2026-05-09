CREATE TABLE inbox_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  actor_id uuid NOT NULL REFERENCES admin_users(id),
  action text NOT NULL,
  detail text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_inbox_activity_customer ON inbox_activity(customer_id);
