import { getLadderLabel } from '@/lib/milestones'
import { TIER_RANK, TIER_PERKS } from '@/lib/tiers'

// Server-only: builds the portal ladder view model. Deliberately NOT imported
// by ClubProgress.tsx (a client-bundled component) — lib/tiers and
// lib/milestones both pull in lib/twilio, which is Node-only (uses the `net`/
// `tls` modules) and breaks the browser bundle if dragged in client-side.
// page.tsx (a server component) resolves the ladder here and passes plain,
// pre-resolved nodes down as props instead.

const RUNG_TIER_LABEL: Record<number, string> = { 2: 'Bailey', 4: 'Elvet', 6: 'Palatine' }
const RUNG_TIER: Record<number, 'bailey' | 'elvet' | 'palatine'> = { 2: 'bailey', 4: 'elvet', 6: 'palatine' }

export type NodeStatus = 'held' | 'done' | 'toBeRevealed' | 'choose' | 'onItsWay' | 'here' | 'ahead'

export type LadderNode = {
  rung: number
  isTier: boolean
  status: NodeStatus
  label: string
  copy: string | null
  smsLink: boolean
  /** Perk rows for tier rungs (2/4/6) — null for gift rungs. Lets the
   * portal ladder expand a tier row to show what it's worth. */
  perks: { label: string; value: string }[] | null
}

type Milestone = { milestone: number; rewardChoice: string | null; fulfilledAt: string | null }

/**
 * Builds the seven-rung ladder view for the portal's ClubProgress card,
 * under the tiers-v3-2 relative-climb model: rungs at or below
 * cycle_start_rung are "held" (the member starts the year standing on
 * them); rungs in (cycle_start_rung, position] resolve per this cycle
 * year's milestone_awards rows and current tier; the rung after position is
 * the "here" marker; everything beyond is "ahead" — including gift rungs
 * earned in a previous year, since a re-passed rung carries a new gift.
 */
export function buildLadderNodes({
  cycleStartRung,
  position,
  cycleYear,
  tier,
  milestones,
}: {
  cycleStartRung: number
  position: number
  cycleYear: number
  tier: string
  milestones: Milestone[]
}): LadderNode[] {
  const byRung = new Map(milestones.map((m) => [m.milestone, m]))
  const hereRung = position < 7 ? position + 1 : null

  const nodes: LadderNode[] = []
  for (let rung = 1; rung <= 7; rung++) {
    const isTier = rung === 2 || rung === 4 || rung === 6
    const label = isTier ? RUNG_TIER_LABEL[rung] : getLadderLabel(rung, cycleYear)
    const perks = isTier ? TIER_PERKS[RUNG_TIER[rung]] : null

    let status: NodeStatus
    let copy: string | null = null
    let smsLink = false

    if (rung <= cycleStartRung) {
      status = 'held'
    } else if (rung <= position) {
      if (isTier) {
        // Tier stays in lockstep with position — checkAndApplyTierUpgrade
        // runs synchronously on every confirmed order (lib/post-charge.ts).
        status = TIER_RANK[tier] >= TIER_RANK[RUNG_TIER[rung]] ? 'done' : 'ahead'
      } else {
        const m = byRung.get(rung)
        if (!m) {
          // Rung passed but no catalogue entry for this cycle year — no
          // award was created (see lib/milestones.ts awardMilestones).
          status = 'toBeRevealed'
        } else if (m.fulfilledAt) {
          status = 'done'
        } else if (m.rewardChoice) {
          status = 'onItsWay'
          if (m.rewardChoice === 'tasting_tickets') {
            copy = 'Text Daniel to book your tastings.'
            smsLink = true
          } else {
            copy = "Chosen — Daniel's arranging it."
          }
        } else {
          status = 'choose'
          copy = 'Ready to claim — text Daniel to choose.'
          smsLink = true
        }
      }
    } else if (hereRung !== null && rung === hereRung) {
      status = 'here'
    } else {
      status = 'ahead'
    }

    nodes.push({ rung, isTier, status, label, copy, smsLink, perks })
  }
  return nodes
}
