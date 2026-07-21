-- Remove the 90-day case deadline: no more countdown, no auto-ship, no
-- automatic charge. case_nudge_1_sent_at becomes the marker for the single
-- gentle reminder that replaces both old nudges; case_nudge_2_sent_at (only
-- ever used by the deleted second nudge and the deleted auto-ship block) is
-- dropped outright.
--
-- Transition is silent (per Julia): no announcement text, no data reset.
-- Existing case_nudge_1_sent_at values carry over into case_reminder_sent_at
-- deliberately — anyone who already received the old day-75 nudge for their
-- current case has had their one reminder and should not get another for the
-- same case. The marker clears on their next shipment as normal.

alter table customers rename column case_nudge_1_sent_at to case_reminder_sent_at;
alter table customers drop column case_nudge_2_sent_at;

comment on column customers.case_started_at is
  'When the current (unshipped) case started filling. No longer a deadline — used only to anchor the single 90-day gentle reminder and admin "days filling case" visibility. Cleared when a shipment is created.';
comment on column customers.case_reminder_sent_at is
  'One-per-case gentle reminder marker (sent at ~90 days of filling). Cleared whenever the case timer resets.';
