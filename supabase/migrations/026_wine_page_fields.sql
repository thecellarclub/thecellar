alter table wines add column image_url text;
alter table wines add column retail_price_pence int;
alter table wines add column website_description text;
alter table wines add column slug text;

create unique index wines_slug_unique on wines (slug) where slug is not null;
