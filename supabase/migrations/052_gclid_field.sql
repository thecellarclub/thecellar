-- Google Ads click-ID capture, mirroring the utm_* fields added in
-- migration 034. Captured from the URL query string alongside the UTM
-- params at phone-verification time (see app/api/signup/verify-code).
-- Needed to eventually import first-order conversions back into Google Ads
-- as offline/enhanced conversions, keyed on gclid rather than campaign/term.

alter table customers
  add column if not exists gclid text;
