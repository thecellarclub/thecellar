# Spec: Tier Benefits — choose-and-stack rewards + targeted free delivery

## Context

This spec builds on `claude-code-prompt-tiers-update.md`, which defines the tier
ladder and assignment logic. **That spec must be implemented first** — this one
assumes its thresholds, `'none' → 'elvet'` rule, and congrats SMS are in place.

The ladder (unchanged):

| Tier | Earned at | Meaning |
|------|-----------|---------|
| `none` | — | Signed up, no order yet |
| `elvet` | First confirmed order (spend < £1,000/yr) | Base member |
| `bailey` | £1,000 rolling 12-month spend | Mid — gift stage |
| `palatine` | £2,500 rolling 12-month spend | Top — gift stage |

Tiers are assigned on rolling 12-month spend from the joining anniversary, via
`lib/tiers.ts → checkAndApplyTierUpgrade()` after each charge.

### Why this spec exists

Two product decisions, both grounded in the order data (May–Jun 2026):

1. **Free delivery should NOT be a tier perk.** The default free-shipping threshold
   stays at a **full 12-bottle case**. Heavy orderers (≈13 buyers, ~14 bottles each)
   already complete a case in ~45 days, so giving them free delivery at 6 bottles just
   forfeits shipping margin on people who'd fill a case anyway. The buyers a 6-bottle
   threshold actually helps are the **light/regular** members (≈34 buyers) who would
   otherwise take 71–81 days to reach 12 and often stall at 2–3 bottles. So free
   delivery at 6 is implemented as a **targeted, grantable nudge** (per-customer, and
   usable in campaigns), not a tier benefit.

2. **Tier rewards must be chooseable**, because the member base is mixed. Of buyers
   with an address on file, ~3:1 are local (NE England — DH/DL/SR/NE/TS) vs non-local,
   plus a large group who collect at the bar. Tasting tickets are gold to locals and
   worthless to the non-local quarter. A fixed reward misfires for someone every time;
   letting members **choose (and at Palatine, stack)** their benefit means the reward
   always lands.

---

## Part A — Targeted free delivery at 6 bottles

### A1. Customer-level flag

Add a per-customer override for the free-shipping bottle threshold.

Migration `042_free_delivery_threshold.sql`:

```sql
alter table customers
  add column free_delivery_bottle_threshold integer;  -- nullable; null = use default (12)

comment on column customers.free_delivery_bottle_threshold is
  'Per-customer override of the free-shipping bottle count. NULL = system default (12). Set to 6 as a targeted nudge for slow-filling members.';
```

### A2. Use the override wherever the case/free-shipping threshold is evaluated

Find where the system decides a case is "complete" / shipping is free (the 12-bottle
logic — check `lib/tiers.ts` neighbours, the case-nudge cron, and shipment-fee
calculation). Replace the hardcoded `12` for the **free-shipping** decision with:

```typescript
const threshold = customer.free_delivery_bottle_threshold ?? 12
```

**Important scope limit:** this override governs **free shipping eligibility only**.
Do NOT change what counts as a full case for shipment-grouping if that would break the
12-bottle case model elsewhere — only the *free delivery* gate moves. If the two are
currently the same code path, split them: a member with a `6` override who has 6
bottles ships free, but the case/shipment record should still behave correctly. Flag
any ambiguity here rather than guessing.

### A3. Admin control + campaign use

- In the admin customer panel (inbox right-hand panel / customer detail), add a small
  control to set/clear this member's free-delivery threshold (`12` default or `6`),
  with the actor logged to `inbox_activity` (`action = 'free_delivery_set'`).
- Make it settable in bulk for a targeted campaign (e.g. "members stuck at 2–3 bottles
  for 30+ days"). A simple admin action or script that sets `= 6` for a supplied list
  of customer IDs is sufficient; no new UI flow required beyond the per-customer toggle
  plus a documented script.

### A4. Optional nudge SMS (build the hook, copy TBD)

When a member is granted the 6-bottle threshold, allow an optional SMS:
> "Good news — your next case ships free as soon as you hit 6 bottles. [link]"
Fire-and-forget, same pattern as other SMS. Leave the exact copy as a constant Daniel
can edit.

---

## Part B — Choose-and-stack tier benefits

### B1. Data model

Members **select** their benefit(s) when they reach a gift stage. Persist the choice.

Migration `043_tier_benefits.sql`:

```sql
-- Catalogue of available benefits
create table tier_benefits (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,            -- e.g. 'tasting_tickets_2'
  label text not null,                  -- display name
  description text,
  min_tier text not null,               -- 'bailey' | 'palatine' (lowest tier that can pick it)
  is_local_only boolean not null default false,  -- true = needs to attend in person
  active boolean not null default true,
  created_at timestamptz default now()
);

-- A member's selected benefit(s) for their current tier cycle
create table customer_benefit_selections (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  benefit_id uuid not null references tier_benefits(id),
  tier_at_selection text not null,      -- the tier they were on when they chose
  selected_at timestamptz default now(),
  fulfilled_at timestamptz,             -- when Daniel actioned it (sent ticket, shipped gift, applied credit)
  fulfilled_by uuid references admin_users(id),
  notes text
);

create index on customer_benefit_selections (customer_id);
```

### B2. Rules

- **Bailey (£1,000):** member may **choose one** active benefit with `min_tier in (bailey)`.
- **Palatine (£2,500):** member may **choose and stack two** benefits with
  `min_tier in (bailey, palatine)` (i.e. Palatine members can also pick Bailey-level
  benefits). Enforce max 2 selections per cycle in the API.
- A "cycle" = the member's current rolling-12-month tier standing. If they renew/retain
  the tier at their anniversary, they re-choose. Keep this simple: selections are
  scoped by `tier_at_selection` + `selected_at`; Daniel can see and re-issue annually.
  Don't over-engineer automatic cycle resets in v1 — surface the data and let admin
  re-grant.

### B3. Seed the benefit menu

Insert these into `tier_benefits` (Daniel can edit/extend later). Mix chosen so every
member — local, non-local, or bar-collector — has something valuable:

| code | label | min_tier | local_only |
|------|-------|----------|------------|
| `tasting_tickets_2` | Two tasting tickets at Norse | bailey | yes |
| `bottle_gift_bailey` | A special gift bottle (sommelier's pick) | bailey | no |
| `free_delivery_12mo` | 12 months' free delivery (no bottle threshold) | bailey | no |
| `cellar_credit_25` | £25 cellar credit | bailey | no |
| `private_tasting_4` | Private tasting for 4 at Norse | palatine | yes |
| `premium_allocation_bottle` | A premium allocation bottle you can't normally buy | palatine | no |
| `priority_allocation` | Priority first-dibs on rare/limited drops | palatine | no |
| `cellar_credit_75` | £75 cellar credit | palatine | no |

> Rationale for the menu: local majority get the experiential anchors (tastings); the
> non-local quarter and bar-collectors always have a bottle / delivery / credit option
> so the reward never lands flat. Priority allocation leans into the scarcity this base
> demonstrably responds to (best wines sold out in 2–8 min median order time).

### B4. Member-facing selection

Where members see their tier (portal, or a link in the congrats SMS flow from the
tiers-update spec), present the benefit menu they're eligible for and let them select
(1 for Bailey, up to 2 for Palatine). On selection, write to
`customer_benefit_selections` and notify admin (`notifyAdmin()`) so Daniel can fulfil.

If there's no member-facing portal surface for this yet, v1 can be **admin-records-the-
choice**: the congrats SMS says "Daniel will be in touch about your benefits" (already
in the tiers-update spec), Daniel asks what they'd like, and records it in the admin
panel. Build the admin path first; member self-select is a fast follow.

### B5. Admin fulfilment view

In the admin area, a simple list of `customer_benefit_selections` where
`fulfilled_at is null` — who chose what, when, and a button to mark fulfilled
(sets `fulfilled_at`/`fulfilled_by`). This is the operational queue so nothing a member
picked gets forgotten (the same failure mode we saw with un-actioned inbox messages).

---

## Part C — Display / reference

Update any tier-benefits display (the table from the tiers-update spec §3) to reflect
that Bailey/Palatine now carry a **choice** of benefits rather than a single fixed one.
Elvet remains base with no gift-stage benefits. Keep the removal of legacy discount
logic from the tiers-update spec.

---

## Dependencies & sequencing

1. **Blocked by `claude-code-prompt-tiers-update.md`** — implement that first
   (thresholds, `039_fix_tier_defaults.sql`, congrats SMS). The live DB currently shows
   ~48 members on `bailey` at ~£200 8-week spend, which indicates the tiers-update data
   fix and threshold logic have **not yet been applied**. Confirm tiers are assigning
   correctly before layering benefits on top, or members will pick gift-stage benefits
   they haven't actually earned.
2. Then Part A (free delivery override) and Part B (benefits) can be built together.

## Files to change (anticipated — verify against repo)

- `supabase/migrations/042_free_delivery_threshold.sql` (new)
- `supabase/migrations/043_tier_benefits.sql` (new)
- `lib/tiers.ts` and/or shipment-fee / case-completion logic — honour
  `free_delivery_bottle_threshold ?? 12` for the free-shipping gate
- Admin customer panel — free-delivery toggle + benefit-selection record + fulfilment queue
- `lib/resend.ts` / SMS hooks — optional nudge SMS, admin notify on selection
- Member portal (if surfacing self-select) — benefit menu
- TypeScript types for the new tables

## Open questions for Claude Code

- Are free-shipping eligibility and "what counts as a full case for shipment grouping"
  the same code path? If so, how should they be split so a 6-bottle free-delivery
  override doesn't corrupt case/shipment records? (See A2.)
- Is there an existing member-facing portal surface to host benefit self-selection, or
  should v1 be admin-only recording? (See B4.)
