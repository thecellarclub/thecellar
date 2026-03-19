-- Migration 010: Add default_address to customers
alter table customers
  add column if not exists default_address jsonb;
