import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { requireAdminSession } from '@/lib/adminAuth'
import { MILESTONE_OPTIONS } from '@/lib/milestones'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await req.json().catch(() => null) as { rewardChoice?: string; fulfilled?: boolean } | null
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const sb = createServiceClient()

  const { data: award } = await sb
    .from('milestone_awards')
    .select('id, milestone, reward_choice, fulfilled_at')
    .eq('id', id)
    .maybeSingle()

  if (!award) {
    return NextResponse.json({ error: 'Milestone award not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}

  if (body.rewardChoice !== undefined) {
    const options = MILESTONE_OPTIONS[award.milestone]
    if (!options || !options.includes(body.rewardChoice)) {
      return NextResponse.json({ error: 'Invalid reward choice for this milestone' }, { status: 400 })
    }
    updates.reward_choice = body.rewardChoice
    updates.chosen_at = new Date().toISOString()
  }

  if (body.fulfilled === true) {
    updates.fulfilled_at = new Date().toISOString()
    updates.fulfilled_by = auth.session.user.id
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await sb.from('milestone_awards').update(updates).eq('id', id)
  if (error) {
    console.error('[admin/milestones] update error', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
