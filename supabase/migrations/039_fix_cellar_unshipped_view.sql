-- Fix customer_cellar_totals view to use shipment_id IS NULL instead of
-- shipped_at IS NULL.  Bottles that have been reserved for a pending shipment
-- (shipment_id set, shipped_at still null) should not count as "unshipped"
-- in the customer list cellar column.

drop view if exists customer_cellar_totals;

create view customer_cellar_totals as
select
  customer_id,
  sum(quantity) as total_bottles
from cellar
where shipment_id is null
group by customer_id;
