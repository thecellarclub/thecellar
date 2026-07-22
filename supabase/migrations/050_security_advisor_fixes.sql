-- Fix the two remaining Supabase security-advisor findings (get_advisors type: security).

-- ERROR: security_definer_view on public.customer_cellar_totals.
-- Recreate as security invoker, preserving the current (039) view definition.
drop view if exists customer_cellar_totals;

create view customer_cellar_totals
  with (security_invoker = true) as
select customer_id, sum(quantity) as total_bottles
from cellar
where shipment_id is null
group by customer_id;

-- WARN: mutable search_path on public.increment_offers_received and public.apply_credit.
alter function public.increment_offers_received(uuid) set search_path = public, pg_temp;
alter function public.apply_credit(uuid, integer, text, text, uuid, uuid) set search_path = public, pg_temp;
