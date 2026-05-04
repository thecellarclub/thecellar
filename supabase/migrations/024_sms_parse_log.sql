-- 024: inbound SMS parse log for admin visibility

create table sms_parse_log (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  inbound_phone text not null,
  raw_message text not null,
  parse_kind text not null,         -- 'quantity' | 'unparseable' | 'keyword:yes' | 'keyword:offer' | etc.
  parse_quantity int,
  ambiguous boolean default false,
  matched_text_id uuid references texts(id),
  created_at timestamptz default now()
);

create index on sms_parse_log (created_at desc);
create index on sms_parse_log (parse_kind);
