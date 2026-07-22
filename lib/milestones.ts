import { createServiceClient } from '@/lib/supabase'
import { sendSms, sanitiseGsm7 } from '@/lib/twilio'
import { notifyAdmin } from '@/lib/resend'
import { getLifetimeCases } from '@/lib/tiers'

type SB = ReturnType<typeof createServiceClient>

/** Lifetime milestones (v3.1 ladder). Single source of truth — consumed by
 * the admin milestones page, the PATCH validation route, and the portal
 * milestones display. */
export const MILESTONES = [1, 3, 5, 7] as const

/** Milestones that self-fulfil with a fixed reward — no choice to record. */
export const AUTO_REWARD: Partial<Record<number, string>> = {
  1: 'free_ship_at_6',
  7: 'coravin',
}

/** Reward options for milestones where the customer/admin picks one. */
export const MILESTONE_OPTIONS: Record<number, string[]> = {
  3: ['free_bottle', 'tasting_tickets'],
  5: ['riedel_glasses', 'tasting_tickets'],
}

export const REWARD_LABELS: Record<string, string> = {
  free_ship_at_6: 'Free shipping at 6 (auto)',
  riedel_glasses: '6 Riedel glasses',
  tasting_tickets: '2 tasting tickets',
  free_bottle: "Free bottle (Daniel's pick)",
  coravin: 'Coravin Timeless (auto)',
}

const UNIQUE_VIOLATION = '23505'

/**
 * Detect and award any lifetime milestones (cases 1/3/5/7) the customer has
 * newly reached. Idempotent (unique constraint on customer_id+milestone) and
 * fire-and-forget — never throws, caller should not block order confirmation
 * on this.
 */
export async function awardMilestones(customerId: string, sb: SB): Promise<void> {
  try {
    const { data: customer } = await sb
      .from('customers')
      .select('phone, free_shipping_at_6')
      .eq('id', customerId)
      .maybeSingle()
    if (!customer) return

    const lifetimeCases = await getLifetimeCases(customerId, sb)

    const { data: existingRows } = await sb
      .from('milestone_awards')
      .select('milestone')
      .eq('customer_id', customerId)

    const already = new Set((existingRows ?? []).map((r) => r.milestone))

    for (const milestone of MILESTONES) {
      if (milestone > lifetimeCases) break
      if (already.has(milestone)) continue

      const insert: Record<string, unknown> = {
        customer_id: customerId,
        milestone,
        reward_choice: AUTO_REWARD[milestone] ?? null,
      }
      if (milestone === 1) {
        insert.fulfilled_at = new Date().toISOString()
        insert.fulfilled_by = null
      }

      const { error: insertErr } = await sb.from('milestone_awards').insert(insert)
      if (insertErr) {
        if ((insertErr as { code?: string }).code === UNIQUE_VIOLATION) continue // already awarded
        console.error('[milestones] insert failed', milestone, insertErr)
        continue
      }

      if (milestone === 1) {
        if (!customer.free_shipping_at_6) {
          await sb.from('customers').update({ free_shipping_at_6: true }).eq('id', customerId)
          await sb.from('inbox_activity').insert({
            customer_id: customerId,
            actor_id: null,
            action: 'free_shipping_at_6_set',
            detail: 'milestone: first case',
          })
        }
        if (customer.phone) {
          // No BALANCE/credit mention here — a brand-new one-case customer has
          // no balance and doesn't earn rebates yet (Bailey+ only). Rule:
          // proactive automated messages only mention BALANCE/credit when the
          // customer's balance is > 0, or the message is itself about credit.
          await sendSms(
            customer.phone,
            sanitiseGsm7(`First case done! Your next shipment is free at just 6 bottles - a little reward from us.`),
            { trigger: 'milestone:1', customerId }
          ).catch((e: unknown) => console.error('[milestones] milestone 1 SMS failed:', e))
        }
      } else if (milestone === 3 || milestone === 5) {
        if (customer.phone) {
          const rewardLine = milestone === 3
            ? `a free bottle (Daniel's pick) or 2 tasting tickets`
            : `6 Riedel glasses or 2 tasting tickets`
          await sendSms(
            customer.phone,
            sanitiseGsm7(`Case ${milestone} done - nice work! You've earned your choice of ${rewardLine}. Daniel will be in touch to sort it.`),
            { trigger: `milestone:${milestone}`, customerId }
          ).catch((e: unknown) => console.error(`[milestones] milestone ${milestone} SMS failed:`, e))
        }
        void notifyAdmin(
          `Milestone ${milestone} reached`,
          `Customer ${customerId} has reached lifetime case ${milestone} and needs their reward choice recorded in the admin fulfilment queue.`
        )
      } else if (milestone === 7) {
        if (customer.phone) {
          await sendSms(
            customer.phone,
            sanitiseGsm7(`Seven cases. Your Coravin Timeless is on its way - Daniel will be in touch. Thank you for being one of our very best members.`),
            { trigger: 'milestone:7', customerId }
          ).catch((e: unknown) => console.error('[milestones] milestone 7 SMS failed:', e))
        }
        void notifyAdmin(
          `Milestone 7 (Coravin) reached`,
          `Customer ${customerId} has reached lifetime case 7 and earned a Coravin Timeless. Mark fulfilled once arranged.`
        )
      }
    }
  } catch (e) {
    console.error('[milestones] awardMilestones failed:', e)
  }
}
