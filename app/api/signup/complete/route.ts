import { NextRequest, NextResponse } from 'next/server'
import { getSignupSession } from '@/lib/session'
import { createServiceClient } from '@/lib/supabase'
import { sendSms } from '@/lib/twilio'

export async function POST(req: NextRequest) {
  try {
    const { line1, line2, city, postcode } = await req.json()

    if (!line1?.trim() || !city?.trim() || !postcode?.trim()) {
      return NextResponse.json({ error: 'Please fill in your address, city and postcode.' }, { status: 400 })
    }

    const session = await getSignupSession()

    // Customer was created at Step 2 — we just need customerId to update the row
    if (!session.phone || !session.phoneVerified || !session.customerId || !session.firstName) {
      return NextResponse.json({ error: 'Session expired. Please start again.' }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { error: updateError } = await supabase
      .from('customers')
      .update({
        default_address: {
          line1: line1.trim(),
          line2: line2?.trim() || null,
          city: city.trim(),
          postcode: postcode.trim().toUpperCase(),
        },
      })
      .eq('id', session.customerId)

    if (updateError) throw updateError

    // Clean up signup_progress now that address is saved
    const { error: progressError } = await supabase
      .from('signup_progress')
      .delete()
      .eq('phone', session.phone)
    if (progressError) console.error('[signup_progress] delete failed:', progressError.message)

    // Send welcome SMS
    try {
      await sendSms(
        session.phone,
        `Welcome, ${session.firstName}! It's Daniel from The Cellar Club.\n\nI'll text you whenever I find something special. If you fancy it, reply how many bottles.\n\nI'll store them in the cellar until you fill a case of 12, then deliver free.\n\nAnd if you've got a question or request, text me anytime.`
      )
    } catch (err) {
      console.error('[complete] welcome SMS failed', err)
    }

    session.destroy()

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[complete]', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
