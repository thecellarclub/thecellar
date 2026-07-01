alter table customers
  add column free_shipping_at_6 boolean not null default false;

comment on column customers.free_shipping_at_6 is
  'One-shot grant: when true, this customer gets free shipping (case complete) at 6 bottles instead of 12. Automatically reset to false the moment it triggers a shipment. Admin must re-enable for another use.';

-- Allow auto-consume of the flag to log an inbox_activity row with no human actor
alter table inbox_activity alter column actor_id drop not null;
