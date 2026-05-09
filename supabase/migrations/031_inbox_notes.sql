CREATE TABLE inbox_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  author_id uuid NOT NULL REFERENCES admin_users(id),
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_inbox_notes_customer ON inbox_notes(customer_id);
