-- Tiers v3: full recompute of every customer's tier from lifetime cases under
-- the new 2/4/6-case ladder (meanings and thresholds both changed vs the old
-- spend-based code — this is not a rename).
--
-- - tier: recomputed from lifetime confirmed-order bottles, floor-divided by 12.
-- - tier_review_at: set to the next first-purchase anniversary (first confirmed
--   order date + N years, strictly in the future). Customers with no confirmed
--   order get tier='none' and tier_review_at=null (nothing to review).
-- - tier_since is intentionally NOT touched here — kept as-is per spec, since it
--   now anchors the case-counting cycle window (see lib/tiers.ts getRollingCases)
--   and a customer's existing value (or null, handled by the fallback to
--   subscribed_at) is still meaningful going forward.
--
-- NOTE: this changes every live customer's tier, delivery fee, and (once
-- CREDIT_REBATE_ENABLED is flipped on) rebate rate immediately. Do not apply
-- without sign-off — see IMPLEMENTATION-LOG.md.

with stats as (
  select
    customer_id,
    min(created_at) as first_order_at,
    floor(sum(quantity) / 12.0) as cases
  from orders
  where order_status = 'confirmed'
  group by customer_id
)
update customers c
set
  tier = case
    when coalesce(s.cases, 0) >= 6 then 'palatine'
    when coalesce(s.cases, 0) >= 4 then 'elvet'
    when coalesce(s.cases, 0) >= 2 then 'bailey'
    else 'none'
  end,
  tier_review_at = case
    when s.first_order_at is null then null
    else s.first_order_at + make_interval(years => extract(year from age(now(), s.first_order_at))::int + 1)
  end
from customers c_all
left join stats s on s.customer_id = c_all.id
where c.id = c_all.id;
