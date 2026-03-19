-- Migration 009: Portal auth fields and customer tier system
-- Run in Supabase SQL editor

alter table customers
  add column if not exists tier text not null default 'none',
  add column if not exists tier_since timestamptz,
  add column if not exists tier_review_at timestamptz,
  add column if not exists backup_payment_method_id text;

-- Index for cron job tier review queries
create index if not exists customers_tier_review_at_idx
  on customers (tier_review_at)
  where tier_review_at is not null;
