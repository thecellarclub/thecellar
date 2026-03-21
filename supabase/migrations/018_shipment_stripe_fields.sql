-- Migration 018: add Stripe fields to shipments table
-- Required for the early-ship (paid £15) flow in handleShipConfirm

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_charge_status text;
