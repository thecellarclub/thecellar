import { createServiceClient } from '@/lib/supabase'
import { sendSms, sanitiseGsm7 } from '@/lib/twilio'
import { notifyAdmin } from '@/lib/resend'
import { getLadderPosition } from '@/lib/tiers'

type SB = ReturnType<typeof createServiceClient>

/** Gift rungs on the ladder (tiers-v3.1). Tier rungs (2/4/6) are handled by
 * lib/tiers.ts — this file only covers the gift-only rungs. */
export const MILESTONES = [1, 3, 5, 7] as const

/** reward_choice -> display label. Flat and year-agnostic: each reward a
 * member can ever be offered gets its own slug here, present or future year,
 * so a slug's label never needs to change once it exists. */
export const REWARD_LABELS: Record<string, string> = {
  free_ship_at_6: 'Free shipping at 6 (auto)',
  riedel_glasses: '6 Riedel glasses',
  tasting_tickets: '2 tasting tickets',
  free_bottle: "Free bottle (Daniel's pick)",
  coravin: 'Coravin Timeless (auto)',
}

type GiftEntry = {
  /** reward_choice value if this gift self-fulfils — no choice to record. */
  auto?: string
  /** reward_choice options if the admin needs to record one. */
  options?: string[]
  /** Only true for the one-shot free_shipping_at_6 grant mechanic. Also
   * marks the award row fulfilled at insert time — nothing for Daniel to
   * arrange, unlike the other gift rungs. */
  setsFreeShippingAt6?: boolean
  /** Short label for the /club-style ladder (portal ClubProgress). */
  ladderLabel: string
  /** SMS sent to the customer the moment the gift is awarded. */
  customerSms: string
  /** Admin fulfilment-queue notification — omitted when nothing needs
   * arranging (the free-shipping-at-6 grant). */
  adminNotify?: { subject: string; body: (customerId: string, rung: number, cycleYear: number) => string }
}

/**
 * Per-year gift catalogue (tiers-v3-2 relative climb): a gift rung earns a
 * DIFFERENT gift each membership year it's passed, keyed by
 * (cycle_year, rung) — nobody ever receives the same gift twice. Year 1 is
 * exactly the live tiers-v3.1 catalogue, so year-1 members see zero
 * behavioural change. Year 2+ entries are deliberately absent until Julia
 * names them — adding a year is a data edit here, never a logic change (see
 * awardMilestones' handling of a missing entry).
 */
export const GIFT_CATALOGUE: Record<number, Partial<Record<number, GiftEntry>>> = {
  1: {
    1: {
      auto: 'free_ship_at_6',
      setsFreeShippingAt6: true,
      ladderLabel: 'Free shipping voucher',
      customerSms: `First case done! Your next shipment is free at just 6 bottles - a little reward from us.`,
    },
    3: {
      options: ['free_bottle', 'tasting_tickets'],
      ladderLabel: 'Free bottle or tasting tickets',
      customerSms: `Case 3 done - nice work! You've earned your choice of a free bottle (Daniel's pick) or 2 tasting tickets. Daniel will be in touch to sort it.`,
      adminNotify: {
        subject: 'Milestone 3 reached',
        body: (customerId) => `Customer ${customerId} has reached case 3 and needs their reward choice recorded in the admin fulfilment queue.`,
      },
    },
    5: {
      options: ['riedel_glasses', 'tasting_tickets'],
      ladderLabel: 'Riedel glasses or tasting tickets',
      customerSms: `Case 5 done - nice work! You've earned your choice of 6 Riedel glasses or 2 tasting tickets. Daniel will be in touch to sort it.`,
      adminNotify: {
        subject: 'Milestone 5 reached',
        body: (customerId) => `Customer ${customerId} has reached case 5 and needs their reward choice recorded in the admin fulfilment queue.`,
      },
    },
    7: {
      auto: 'coravin',
      ladderLabel: 'Coravin Timeless',
      customerSms: `Seven cases. Your Coravin Timeless is on its way - Daniel will be in touch. Thank you for being one of our very best members.`,
      adminNotify: {
        subject: 'Milestone 7 (Coravin) reached',
        body: (customerId) => `Customer ${customerId} has reached case 7 and earned a Coravin Timeless. Mark fulfilled once arranged.`,
      },
    },
  },
  // Year 2+ deliberately absent — Julia will name these before the first
  // anniversaries land (~March 2027).
}

export function getGiftEntry(rung: number, cycleYear: number): GiftEntry | null {
  return GIFT_CATALOGUE[cycleYear]?.[rung] ?? null
}

/** Reward options for a gift rung in a given cycle year — [] if the rung
 * self-fulfils or has no catalogue entry for that year. */
export function getMilestoneOptions(rung: number, cycleYear: number): string[] {
  return getGiftEntry(rung, cycleYear)?.options ?? []
}

/** Short ladder label for a gift rung in a given cycle year, for the
 * portal's ladder view. Falls back to a "to be revealed" line when the
 * catalogue has no entry yet for that year — never shows a prior year's
 * gift for a rung being passed again. */
export function getLadderLabel(rung: number, cycleYear: number): string {
  return getGiftEntry(rung, cycleYear)?.ladderLabel ?? 'A new reward - to be revealed'
}

const UNIQUE_VIOLATION = '23505'

/**
 * Detect and award any gift rungs the customer has newly passed THIS
 * membership year — rungs in (cycle_start_rung, position] ∩ {1,3,5,7} with no
 * `milestone_awards` row yet for (customer_id, rung, cycle_year). Rungs at or
 * below cycle_start_rung are held from a prior year and never re-award here.
 * Idempotent (unique constraint on customer_id+milestone+cycle_year) and
 * fire-and-forget — never throws, caller should not block order confirmation
 * on this.
 */
export async function awardMilestones(customerId: string, sb: SB): Promise<void> {
  try {
    const { data: customer } = await sb
      .from('customers')
      .select('phone, free_shipping_at_6, cycle_start_rung, cycle_year')
      .eq('id', customerId)
      .maybeSingle()
    if (!customer) return

    const cycleStartRung = customer.cycle_start_rung ?? 0
    const cycleYear = customer.cycle_year ?? 1
    const position = await getLadderPosition(customerId, sb)

    const { data: existingRows } = await sb
      .from('milestone_awards')
      .select('milestone')
      .eq('customer_id', customerId)
      .eq('cycle_year', cycleYear)

    const already = new Set((existingRows ?? []).map((r) => r.milestone))

    for (const rung of MILESTONES) {
      if (rung <= cycleStartRung) continue // held from a prior year, not re-awarded
      if (rung > position) break
      if (already.has(rung)) continue

      const entry = getGiftEntry(rung, cycleYear)
      if (!entry) {
        void notifyAdmin(
          `No gift defined for rung ${rung}, year ${cycleYear}`,
          `Customer ${customerId} passed rung ${rung} in membership year ${cycleYear}, but lib/milestones.ts has no gift catalogue entry for that (rung, year) pair yet. No award was recorded and no SMS was sent — define the year-${cycleYear} gift in GIFT_CATALOGUE.`
        )
        continue
      }

      const insert: Record<string, unknown> = {
        customer_id: customerId,
        milestone: rung,
        cycle_year: cycleYear,
        reward_choice: entry.auto ?? null,
      }
      if (entry.setsFreeShippingAt6) {
        insert.fulfilled_at = new Date().toISOString()
        insert.fulfilled_by = null
      }

      const { error: insertErr } = await sb.from('milestone_awards').insert(insert)
      if (insertErr) {
        if ((insertErr as { code?: string }).code === UNIQUE_VIOLATION) continue // already awarded
        console.error('[milestones] insert failed', rung, cycleYear, insertErr)
        continue
      }

      if (entry.setsFreeShippingAt6 && !customer.free_shipping_at_6) {
        await sb.from('customers').update({ free_shipping_at_6: true }).eq('id', customerId)
        await sb.from('inbox_activity').insert({
          customer_id: customerId,
          actor_id: null,
          action: 'free_shipping_at_6_set',
          detail: 'milestone: first case',
        })
      }

      // No BALANCE/credit mention in any of these — proactive automated
      // messages only mention BALANCE/credit when the customer's balance is
      // > 0, or the message is itself about credit.
      if (customer.phone) {
        await sendSms(customer.phone, sanitiseGsm7(entry.customerSms), { trigger: `milestone:${rung}`, customerId }).catch(
          (e: unknown) => console.error(`[milestones] rung ${rung} SMS failed:`, e)
        )
      }

      if (entry.adminNotify) {
        void notifyAdmin(entry.adminNotify.subject, entry.adminNotify.body(customerId, rung, cycleYear))
      }
    }
  } catch (e) {
    console.error('[milestones] awardMilestones failed:', e)
  }
}
