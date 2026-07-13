-- Tiers v3: lifetime one-time-ever milestone rewards (cases 1/3/5/6).
-- The unique constraint on (customer_id, milestone) IS the one-time-ever
-- guarantee. Rows are never deleted on anniversary reset — milestones ignore
-- the rolling tier window entirely.

create table milestone_awards (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  milestone integer not null check (milestone in (1, 3, 5, 6)),
  reward_choice text,          -- null until chosen; see claude-code-prompt-tiers-v3.md §2a
  chosen_at timestamptz,
  fulfilled_at timestamptz,
  fulfilled_by uuid references admin_users(id),
  notes text,
  created_at timestamptz not null default now(),
  unique (customer_id, milestone)
);

create index on milestone_awards (customer_id);
create index on milestone_awards (fulfilled_at) where fulfilled_at is null;
