-- =============================================================
-- Cellar Text — Database Schema
-- Paste into the Supabase SQL editor and run.
-- =============================================================

-- CUSTOMERS
-- One row per subscriber. Phone is the primary identifier (used to match inbound SMS).
create table customers (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,           -- E.164 format e.g. +447700900000
  email text unique not null,
  first_name text,
  stripe_customer_id text unique,       -- Stripe Customer object ID
  stripe_payment_method_id text,        -- Default saved card
  dob date not null,                    -- For age verification
  age_verified boolean default false,   -- True once DOB confirmed 18+
  active boolean default true,          -- False if they've unsubscribed
  gdpr_marketing_consent boolean default false,
  gdpr_consent_at timestamptz,
  subscribed_at timestamptz default now(),
  unsubscribed_at timestamptz
);

-- WINES
-- Each wine you might offer. Created in admin before sending a text.
create table wines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  producer text,
  region text,
  country text,
  vintage int,
  description text,                     -- What goes in the text message
  price_pence int not null,             -- Store in pence, avoid float issues
  stock_bottles int not null default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- TEXTS
-- Each blast sent to subscribers. One row per send event.
create table texts (
  id uuid primary key default gen_random_uuid(),
  wine_id uuid references wines(id),
  body text not null,                   -- Exact message sent
  sent_at timestamptz default now(),
  recipient_count int
);

-- SHIPMENTS
-- When a customer hits 12 bottles and requests their case.
-- Defined before orders/cellar because cellar references it.
create table shipments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  bottle_count int not null,
  shipping_address jsonb,
  status text default 'pending',        -- 'pending' | 'dispatched' | 'delivered'
  tracking_number text,
  created_at timestamptz default now(),
  dispatched_at timestamptz
);

-- ORDERS
-- One row per order placed in response to a text.
create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  wine_id uuid references wines(id),
  text_id uuid references texts(id),
  quantity int not null,
  price_pence int not null,             -- Price at time of order (snapshotted)
  total_pence int not null,             -- quantity * price_pence
  stripe_payment_intent_id text,
  stripe_charge_status text,            -- 'pending' | 'succeeded' | 'failed' | 'requires_action'
  created_at timestamptz default now()
);

-- CELLAR
-- Bottles held for each customer. Separate from orders for clarity.
create table cellar (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  wine_id uuid references wines(id),
  order_id uuid references orders(id),
  quantity int not null,
  added_at timestamptz default now(),
  shipped_at timestamptz,
  shipment_id uuid references shipments(id)
);

-- VERIFICATION_CODES
-- Temporary SMS codes for phone verification at sign-up.
create table verification_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code text not null,
  expires_at timestamptz not null,
  used boolean default false,
  attempt_count int default 0,
  created_at timestamptz default now()
);

-- =============================================================
-- VIEWS
-- =============================================================

-- Customer cellar totals (unshipped bottles per customer)
create view customer_cellar_totals as
select
  customer_id,
  sum(quantity) as total_bottles
from cellar
where shipped_at is null
group by customer_id;
