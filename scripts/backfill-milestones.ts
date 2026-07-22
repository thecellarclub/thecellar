/**
 * One-time backfill for tiers-v3 lifetime milestones (cases 1/3/5/7 as of
 * tiers-v3.1). See claude-code-prompt-tiers-v3.md §2c /
 * claude-code-prompt-tiers-v3-1.md §3.
 *
 * Run with: npx tsx scripts/backfill-milestones.ts        (dry-run, report only)
 *           npx tsx scripts/backfill-milestones.ts --live (actually writes)
 *
 * Dry-run first, always — per the spec, share the report with Julia before
 * running --live. No SMS is ever sent by this script (backfilled members are
 * messaged personally by Julia, per the spec).
 *
 * Milestone 1 special case: if a customer's free_shipping_at_6 flag is already
 * true, OR inbox_activity shows it was ever granted (the July 2026 engagement
 * campaign already covered most eligible members), the milestone row is
 * created already-fulfilled with notes='pre-granted via engagement campaign'
 * and the flag is left untouched. Only customers who never received the flag
 * get it newly set here, with notes='backfilled at v3 launch'.
 */
import { createClient } from '@supabase/supabase-js'

const MILESTONES = [1, 3, 5, 7] as const

const AUTO_REWARD: Partial<Record<number, string>> = {
  1: 'free_ship_at_6',
  7: 'coravin',
}

async function main() {
  const live = process.argv.includes('--live')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  const sb = createClient(supabaseUrl, supabaseKey)

  const { data: customers, error: custErr } = await sb
    .from('customers')
    .select('id, first_name, last_name, phone, free_shipping_at_6')
  if (custErr) throw custErr

  const { data: orders, error: ordersErr } = await sb
    .from('orders')
    .select('customer_id, quantity')
    .eq('order_status', 'confirmed')
  if (ordersErr) throw ordersErr

  const bottlesByCustomer = new Map<string, number>()
  for (const o of orders ?? []) {
    bottlesByCustomer.set(o.customer_id, (bottlesByCustomer.get(o.customer_id) ?? 0) + o.quantity)
  }

  const { data: existingAwards, error: awardsErr } = await sb
    .from('milestone_awards')
    .select('customer_id, milestone')
  if (awardsErr) throw awardsErr
  const existing = new Set((existingAwards ?? []).map((a) => `${a.customer_id}:${a.milestone}`))

  const { data: grantedActivity, error: activityErr } = await sb
    .from('inbox_activity')
    .select('customer_id')
    .eq('action', 'free_shipping_at_6_set')
  if (activityErr) throw activityErr
  const everGranted = new Set((grantedActivity ?? []).map((a) => a.customer_id))

  let milestone1Count = 0
  let milestone1PreGranted = 0
  let milestone3Count = 0
  let milestone5Count = 0
  let milestone7Count = 0
  const rows: string[] = []

  for (const c of customers ?? []) {
    const bottles = bottlesByCustomer.get(c.id) ?? 0
    const lifetimeCases = Math.floor(bottles / 12)
    if (lifetimeCases < 1) continue

    const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.phone
    const toCreate: string[] = []

    for (const milestone of MILESTONES) {
      if (milestone > lifetimeCases) break
      if (existing.has(`${c.id}:${milestone}`)) continue

      if (milestone === 1) {
        const preGranted = !!c.free_shipping_at_6 || everGranted.has(c.id)
        milestone1Count++
        if (preGranted) milestone1PreGranted++
        toCreate.push(`1 (${preGranted ? 'pre-granted, flag untouched' : 'NEW — flag will be set'})`)

        if (live) {
          await sb.from('milestone_awards').insert({
            customer_id: c.id,
            milestone: 1,
            reward_choice: AUTO_REWARD[1],
            fulfilled_at: new Date().toISOString(),
            fulfilled_by: null,
            notes: preGranted ? 'pre-granted via engagement campaign' : 'backfilled at v3 launch',
          })
          if (!preGranted) {
            await sb.from('customers').update({ free_shipping_at_6: true }).eq('id', c.id)
            await sb.from('inbox_activity').insert({
              customer_id: c.id,
              actor_id: null,
              action: 'free_shipping_at_6_set',
              detail: 'milestone: first case (backfill)',
            })
          }
        }
      } else {
        if (milestone === 3) milestone3Count++
        if (milestone === 5) milestone5Count++
        if (milestone === 7) milestone7Count++
        toCreate.push(String(milestone))

        if (live) {
          await sb.from('milestone_awards').insert({
            customer_id: c.id,
            milestone,
            reward_choice: AUTO_REWARD[milestone] ?? null,
            notes: 'backfilled at v3 launch',
          })
        }
      }
    }

    if (toCreate.length > 0) {
      rows.push(`${name.padEnd(28)} lifetime cases=${lifetimeCases}  milestones: ${toCreate.join(', ')}`)
    }
  }

  console.log(`\n${live ? 'LIVE RUN' : 'DRY RUN'} — tiers-v3 milestone backfill\n`)
  console.log(rows.length > 0 ? rows.join('\n') : '(nothing to backfill)')
  console.log(`\nSummary: milestone 1: ${milestone1Count} (${milestone1PreGranted} pre-granted, ${milestone1Count - milestone1PreGranted} new flag grants) | milestone 3: ${milestone3Count} | milestone 5: ${milestone5Count} | milestone 7: ${milestone7Count}`)
  console.log(`No SMS sent by this script — Julia messages backfilled members personally.\n`)

  if (!live) {
    console.log('Dry run only — re-run with --live to write these rows.\n')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
