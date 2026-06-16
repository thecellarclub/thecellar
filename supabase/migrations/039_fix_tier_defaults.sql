-- Upgrade to elvet any customers with confirmed orders who are still on 'none'
update customers c
set tier = 'elvet',
    tier_since = now()
where c.tier = 'none'
  and exists (
    select 1 from orders o
    where o.customer_id = c.id
      and o.order_status = 'confirmed'
  );
