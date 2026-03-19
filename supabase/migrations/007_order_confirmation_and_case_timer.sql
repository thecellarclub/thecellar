-- 007: order confirmation flow + 90-day case timer

-- orders: add order_status and confirmation_expires_at
alter table orders
  add column if not exists order_status text not null default 'awaiting_confirmation',
  add column if not exists confirmation_expires_at timestamptz;

-- Back-fill existing orders as confirmed (they were charged immediately in the old flow)
update orders
  set order_status = 'confirmed'
  where order_status = 'awaiting_confirmation';

-- customers: 90-day case timer columns
alter table customers
  add column if not exists case_started_at timestamptz,
  add column if not exists case_nudge_1_sent_at timestamptz,
  add column if not exists case_nudge_2_sent_at timestamptz;

-- shipments: shipping fee (was missing from original schema)
alter table shipments
  add column if not exists shipping_fee_pence int not null default 0;
