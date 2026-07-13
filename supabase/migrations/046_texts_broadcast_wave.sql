-- Tiers v3 §5: Palatine 2hr early access. Wine offer blasts now go out in two
-- waves — Palatine members immediately, everyone else after a delay. v1 is a
-- manual second-wave trigger (no cron — existing crons all run once daily,
-- and a delayed-send cron would need much finer granularity); an admin clicks
-- "Send to everyone else" from the text detail page once ready.

alter table texts
  add column broadcast_at timestamptz,
  add column broadcast_sent_at timestamptz;
