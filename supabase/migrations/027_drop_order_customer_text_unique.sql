-- Allow multiple orders per customer per broadcast (re-order / top-up flow)
DROP INDEX IF EXISTS orders_customer_text_unique_idx;
