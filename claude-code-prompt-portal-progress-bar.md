# Claude Code Prompt — Portal: Tier Progress Bar

## What to build

Add a visual progress bar to the customer portal dashboard showing their rolling 12-month spend vs the next tier threshold.

---

## Step 1 — Fetch rolling 12-month spend in the dashboard server component

In `app/portal/dashboard/page.tsx`, after the existing cellar query, add:

```ts
// Rolling 12-month spend (confirmed charges only)
const twelveMonthsAgo = new Date()
twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)

const { data: spendRows } = await sb
  .from('orders')
  .select('total_pence')
  .eq('customer_id', customer.id)
  .eq('stripe_charge_status', 'succeeded')
  .gte('created_at', twelveMonthsAgo.toISOString())

const rollingSpendPence = (spendRows ?? []).reduce((s, r) => s + (r.total_pence ?? 0), 0)
```

Pass `rollingSpendPence` as a new prop to `<DashboardClient />`.

Update the `Props` interface in `DashboardClient.tsx` to include `rollingSpendPence: number`.

---

## Step 2 — Add the TierProgress component to DashboardClient

Add this component above the `export default function DashboardClient` line in `app/portal/dashboard/DashboardClient.tsx`:

```tsx
function TierProgress({
  tier,
  spendPence,
}: {
  tier: string
  spendPence: number
}) {
  const spend = spendPence / 100

  type TierConfig = {
    label: string
    nextLabel: string | null
    current: number
    target: number | null
    color: string
  }

  const config: TierConfig = (() => {
    if (tier === 'palatine') {
      return {
        label: 'Palatine',
        nextLabel: null,
        current: spend,
        target: null,
        color: '#C9851D',
      }
    }
    if (tier === 'elvet') {
      return {
        label: 'Elvet',
        nextLabel: 'Palatine',
        current: Math.max(0, spend - 500),
        target: 500, // £500 to £1,000
        color: '#C9851D',
      }
    }
    // Bailey (or none)
    return {
      label: 'Bailey',
      nextLabel: 'Elvet',
      current: spend,
      target: 500,
      color: '#9B1B30',
    }
  })()

  const pct = config.target
    ? Math.min(100, Math.round((config.current / config.target) * 100))
    : 100

  const formatGBP = (n: number) =>
    n >= 1000
      ? `£${(n / 1000).toFixed(1)}k`
      : `£${Math.round(n)}`

  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-2">
        <span
          className="font-sans text-xs uppercase tracking-[0.2em]"
          style={{ color: config.color }}
        >
          {config.label}
        </span>
        {config.nextLabel ? (
          <span className="font-sans text-xs text-cream/40">
            {formatGBP(config.current + (tier === 'elvet' ? 500 : 0))} /{' '}
            {tier === 'elvet' ? '£1,000' : '£500'} towards {config.nextLabel}
          </span>
        ) : (
          <span className="font-sans text-xs text-cream/40">
            {formatGBP(spend)} this year
          </span>
        )}
      </div>

      {/* Track */}
      <div
        className="relative h-1.5 rounded-full overflow-hidden"
        style={{ background: 'rgba(240,230,220,0.1)' }}
      >
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: config.color,
            opacity: 0.85,
          }}
        />
      </div>

      {config.nextLabel && (
        <p className="font-sans text-xs text-cream/30 mt-1.5">
          {formatGBP(Math.max(0, (config.target ?? 0) - config.current)} to go
        </p>
      )}
    </div>
  )
}
```

---

## Step 3 — Place it in the dashboard UI

In the `DashboardClient` component, find the tier card section (where `tier` and `tierSince` are displayed). Place `<TierProgress tier={tier} spendPence={rollingSpendPence} />` directly below the tier name / tier label display, above the cellar section.

---

## Step 4 — Build check

Run `npm run build` to confirm no TypeScript errors. Pay attention to the `TierProgress` component's type usage — make sure `config.target` null checks are handled correctly wherever arithmetic is done on it.
