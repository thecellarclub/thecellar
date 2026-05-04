-- 023: payment_failed state for orders + retry tracking columns

alter table orders
  add column if not exists payment_failed_at timestamptz,
  add column if not exists payment_failed_attempts int not null default 0,
  add column if not exists payment_failed_last_message_at timestamptz;

-- Index for the payment-retry cron to efficiently find open failed orders
create index if not exists orders_payment_failed_idx
  on orders (order_status, payment_failed_attempts)
  where order_status = 'payment_failed';
