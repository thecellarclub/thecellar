create table sms_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  phone text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  created_at timestamptz default now(),
  twilio_sid text,
  trigger text
);
create index on sms_messages (created_at desc);
create index on sms_messages (customer_id, created_at desc);
create index on sms_messages (phone, created_at desc);
