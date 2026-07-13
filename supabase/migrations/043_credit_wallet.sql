-- Credit wallet: one-time admin grants + tier rebates.
-- See claude-code-prompt-credit-wallet.md for the full spec.

alter table customers
  add column credit_balance_pence integer not null default 0
    check (credit_balance_pence >= 0);

alter table orders
  add column credit_used_pence integer not null default 0
    check (credit_used_pence >= 0);

create table credit_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  delta_pence integer not null check (delta_pence <> 0),
  reason text not null check (reason in ('rebate', 'redemption', 'admin_grant')),
  note text,                              -- required (app-enforced) for admin_grant
  order_id uuid references orders(id),
  created_by uuid references admin_users(id),  -- set for admin_grant, null otherwise
  balance_after_pence integer not null check (balance_after_pence >= 0),
  created_at timestamptz not null default now()
);

create index on credit_ledger (customer_id, created_at desc);

-- Idempotency: at most one rebate and one redemption per order
create unique index credit_ledger_one_rebate_per_order
  on credit_ledger (order_id) where reason = 'rebate';
create unique index credit_ledger_one_redemption_per_order
  on credit_ledger (order_id) where reason = 'redemption';

-- Single mutation path: balance + ledger row move together, atomically.
-- Raises if the resulting balance would be negative (via the CHECK constraint).
create or replace function apply_credit(
  p_customer_id uuid,
  p_delta_pence integer,
  p_reason text,
  p_note text default null,
  p_order_id uuid default null,
  p_created_by uuid default null
) returns integer  -- new balance in pence
language plpgsql as $$
declare
  v_new_balance integer;
begin
  update customers
    set credit_balance_pence = credit_balance_pence + p_delta_pence
    where id = p_customer_id
    returning credit_balance_pence into v_new_balance;

  if v_new_balance is null then
    raise exception 'customer not found';
  end if;
  -- CHECK constraint raises if v_new_balance < 0

  insert into credit_ledger
    (customer_id, delta_pence, reason, note, order_id, created_by, balance_after_pence)
  values
    (p_customer_id, p_delta_pence, p_reason, p_note, p_order_id, p_created_by, v_new_balance);

  return v_new_balance;
end $$;
