/**
 * One-time script to send the three engagement campaign segments via Twilio.
 * See claude-code-prompt-engagement-campaign-send.md for the spec.
 *
 * Run with: npx tsx scripts/send-engagement-campaign.ts --segment=1 [--live]
 *
 * Segment 2's population is the live rule (>=1 confirmed order AND <4 unshipped
 * cellar bottles), not the flag — free_shipping_at_6 has already been
 * backfilled to true for everyone currently matching that rule.
 *
 * sms_messages (the table the original spec's idempotency check assumed) was
 * dropped in migration 041, and sendSms() no longer logs outbound messages
 * anywhere. Idempotency here is tracked in a local JSON file instead
 * (scripts/engagement-campaign-sent-log.json), written to after every
 * successful --live send and checked before sending.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { sendSms, sanitiseGsm7 } from '../lib/twilio'
import { createServiceClient } from '../lib/supabase'

type SB = ReturnType<typeof createServiceClient>

const LOG_PATH = join(__dirname, 'engagement-campaign-sent-log.json')

type SentLog = Record<string, string[]> // segment key -> phone numbers already sent

function loadSentLog(): SentLog {
  if (!existsSync(LOG_PATH)) return {}
  return JSON.parse(readFileSync(LOG_PATH, 'utf-8'))
}

function appendSentLog(segmentKey: string, phone: string) {
  const log = loadSentLog()
  if (!log[segmentKey]) log[segmentKey] = []
  log[segmentKey].push(phone)
  writeFileSync(LOG_PATH, JSON.stringify(log, null, 2))
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function titleCaseName(name: string | null): string | null {
  if (!name) return null
  const trimmed = name.trim()
  if (!trimmed) return null
  // If stored ALL-CAPS, convert to title case; otherwise leave as-is.
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return trimmed
      .toLowerCase()
      .split(/(\s+|-)/)
      .map((part) => (/^[a-z]/.test(part) ? part[0].toUpperCase() + part.slice(1) : part))
      .join('')
  }
  return trimmed
}

type Recipient = { id: string; phone: string; firstName: string | null }

async function getSegment1(sb: SB): Promise<Recipient[]> {
  const { data, error } = await sb
    .from('customers')
    .select('id, phone, first_name, stripe_payment_method_id, unsubscribed_at, status')
    .not('stripe_payment_method_id', 'is', null)
    .is('unsubscribed_at', null)
    .neq('status', 'deactivated')
  if (error) throw error

  const { data: confirmedOrders, error: ordersErr } = await sb
    .from('orders')
    .select('customer_id')
    .eq('order_status', 'confirmed')
  if (ordersErr) throw ordersErr
  const confirmedIds = new Set((confirmedOrders ?? []).map((o) => o.customer_id))

  return (data ?? [])
    .filter((c) => !confirmedIds.has(c.id) && c.phone)
    .map((c) => ({ id: c.id, phone: c.phone as string, firstName: titleCaseName(c.first_name) }))
}

async function getSegment2(sb: SB): Promise<Recipient[]> {
  const { data, error } = await sb
    .from('customers')
    .select('id, phone, first_name, unsubscribed_at, status')
    .is('unsubscribed_at', null)
    .neq('status', 'deactivated')
  if (error) throw error

  const { data: confirmedOrders, error: ordersErr } = await sb
    .from('orders')
    .select('customer_id')
    .eq('order_status', 'confirmed')
  if (ordersErr) throw ordersErr
  const confirmedIds = new Set((confirmedOrders ?? []).map((o) => o.customer_id))

  const { data: cellarRows, error: cellarErr } = await sb
    .from('cellar')
    .select('customer_id, quantity')
    .is('shipment_id', null)
  if (cellarErr) throw cellarErr
  const unshippedByCustomer = new Map<string, number>()
  for (const row of cellarRows ?? []) {
    unshippedByCustomer.set(row.customer_id, (unshippedByCustomer.get(row.customer_id) ?? 0) + row.quantity)
  }

  return (data ?? [])
    .filter((c) => confirmedIds.has(c.id) && (unshippedByCustomer.get(c.id) ?? 0) < 4 && c.phone)
    .map((c) => ({ id: c.id, phone: c.phone as string, firstName: titleCaseName(c.first_name) }))
}

async function getSegment3(sb: SB): Promise<Recipient[]> {
  const { data, error } = await sb
    .from('customers')
    .select('id, phone, first_name, stripe_payment_method_id, unsubscribed_at, status')
    .is('stripe_payment_method_id', null)
    .is('unsubscribed_at', null)
    .neq('status', 'deactivated')
  if (error) throw error

  const { data: confirmedOrders, error: ordersErr } = await sb
    .from('orders')
    .select('customer_id')
    .eq('order_status', 'confirmed')
  if (ordersErr) throw ordersErr
  const confirmedIds = new Set((confirmedOrders ?? []).map((o) => o.customer_id))

  return (data ?? [])
    .filter((c) => !confirmedIds.has(c.id) && c.phone)
    .map((c) => ({ id: c.id, phone: c.phone as string, firstName: titleCaseName(c.first_name) }))
}

function buildBody(segment: number, firstName: string | null): string {
  if (segment === 1) {
    return `Hello ${firstName} - I saw you saved your card but hadnt ordered yet. What do you normally like to drink? Can I find you something to get you started?`
  }
  if (segment === 2) {
    return `Hello ${firstName} - so great to see you made your first orders. As a little thank you, I've dropped your free shipping to 6 bottles (instead of 12) for this first shipment! What would you like to see more of?`
  }
  // Segment 3
  if (firstName) {
    return `Hello ${firstName} - you signed up a little while back but haven't ordered yet, and I'd love to know why. Was it the wines, the prices, the way it works over text, or just timing? Totally honest answers welcome.`
  }
  return `You signed up a little while back but haven't ordered yet, and I'd love to know why. Was it the wines, the prices, the way it works over text, or just timing? Totally honest answers welcome.`
}

async function main() {
  const args = process.argv.slice(2)
  const segmentArg = args.find((a) => a.startsWith('--segment='))
  const live = args.includes('--live')

  if (!segmentArg) {
    console.error('Usage: npx tsx scripts/send-engagement-campaign.ts --segment=1|2|3 [--live]')
    process.exit(1)
  }
  const segment = parseInt(segmentArg.split('=')[1], 10)
  if (![1, 2, 3].includes(segment)) {
    console.error('--segment must be 1, 2, or 3')
    process.exit(1)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  const sb = createServiceClient()

  const recipients =
    segment === 1 ? await getSegment1(sb) : segment === 2 ? await getSegment2(sb) : await getSegment3(sb)

  const segmentKey = `seg${segment}`
  const sentLog = loadSentLog()
  const alreadySent = new Set(sentLog[segmentKey] ?? [])

  console.log(`Segment ${segment}: ${recipients.length} total recipients (before idempotency skip)\n`)

  if (!live) {
    for (const r of recipients) {
      const body = sanitiseGsm7(buildBody(segment, r.firstName))
      const skip = alreadySent.has(r.phone) ? ' [ALREADY SENT — would skip]' : ''
      console.log(`${r.phone} | ${r.firstName ?? '(no name)'} | ${body}${skip}`)
    }
    console.log(`\nDRY RUN — total: ${recipients.length}, would skip: ${recipients.filter((r) => alreadySent.has(r.phone)).length}, would send: ${recipients.filter((r) => !alreadySent.has(r.phone)).length}`)
    return
  }

  let sent = 0
  let skipped = 0
  const failed: { phone: string; error: string }[] = []

  for (const r of recipients) {
    if (alreadySent.has(r.phone)) {
      console.log(`SKIP (already sent): ${r.phone}`)
      skipped++
      continue
    }
    const body = sanitiseGsm7(buildBody(segment, r.firstName))
    try {
      await sendSms(r.phone, body, { trigger: `engagement-campaign:seg${segment}`, customerId: r.id })
      appendSentLog(segmentKey, r.phone)
      console.log(`SENT: ${r.phone}`)
      sent++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`FAILED: ${r.phone} — ${message}`)
      failed.push({ phone: r.phone, error: message })
    }
    await sleep(750)
  }

  console.log(`\nSummary — attempted: ${recipients.length}, sent: ${sent}, skipped: ${skipped}, failed: ${failed.length}`)
  if (failed.length > 0) {
    console.log('Failures:')
    for (const f of failed) console.log(`  ${f.phone}: ${f.error}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
