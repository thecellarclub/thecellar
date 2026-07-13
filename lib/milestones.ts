import { createServiceClient } from '@/lib/supabase'
import { sendSms, sanitiseGsm7 } from '@/lib/twilio'
import { notifyAdmin } from '@/lib/resend'
import { getLifetimeCases } from '@/lib/tiers'

type SB = ReturnType<typeof createServiceClient>

const MILESTONES = [1, 3, 5, 6] as const

const AUTO_REWARD: Partial<Record<number, string>> = {
  1: 'free_ship_at_6',
  6: 'coravin',
}

const UNIQUE_VIOLATION = '23505'

/**
 * Detect and award any lifetime milestones (cases 1/3/5/6) the customer has
 * newly reached. Idempotent (unique constraint on customer_id+milestone) and
 * fire-and-forget — never throws, caller should not block order confirmation
 * on this.
 *
 * `skipSmsForMilestone` suppresses that milestone's own customer SMS when the
 * caller already sent a combined message covering it — milestone 6 coincides
 * with the Palatine tier-upgrade congrats SMS (see lib/tiers.ts /
 * lib/post-charge.ts), so the two are never sent separately.
 */
export async function awardMilestones(
  customerId: string,
  sb: SB,
  opts?: { skipSmsForMilestone?: number }
): Promise<void> {
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
          await sendSms(
            customer.phone,
            sanitiseGsm7(`First case done! Your next shipment is free at just 6 bottles - a little reward from us. Reply BALANCE any time to check your credit.`),
            { trigger: 'milestone:1', customerId }
          ).catch((e: unknown) => console.error('[milestones] milestone 1 SMS failed:', e))
        }
      } else if (milestone === 3 || milestone === 5) {
        if (customer.phone) {
          const rewardLine = milestone === 3
            ? `6 Riedel glasses or 2 tasting tickets`
            : `a free bottle (Daniel's pick) or 2 tasting tickets`
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
      } else if (milestone === 6) {
        if (customer.phone && opts?.skipSmsForMilestone !== 6) {
          await sendSms(
            customer.phone,
            sanitiseGsm7(`Case 6 done - you've earned a Coravin! Daniel will be in touch to arrange it.`),
            { trigger: 'milestone:6', customerId }
          ).catch((e: unknown) => console.error('[milestones] milestone 6 SMS failed:', e))
        }
        void notifyAdmin(
          `Milestone 6 (Coravin) reached`,
          `Customer ${customerId} has reached lifetime case 6 and earned a Coravin. Mark fulfilled once arranged.`
        )
      }
    }
  } catch (e) {
    console.error('[milestones] awardMilestones failed:', e)
  }
}
