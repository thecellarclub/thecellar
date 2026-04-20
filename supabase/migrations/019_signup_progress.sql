create table if not exists signup_progress (
  id            uuid primary key default gen_random_uuid(),
  phone         text unique not null,
  email         text,
  first_name    text,
  last_name     text,
  dob           date,
  age_verified  boolean default false,
  stripe_customer_id        text,
  stripe_payment_method_id  text,
  last_step     text not null default 'phone',   -- 'phone' | 'verified' | 'details' | 'card_started' | 'card_complete'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Index for quick look-up by phone
create index if not exists signup_progress_phone_idx on signup_progress(phone);
