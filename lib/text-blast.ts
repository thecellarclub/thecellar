import { twilioClient } from '@/lib/twilio'
import { createServiceClient } from '@/lib/supabase'

type SB = ReturnType<typeof createServiceClient>

export interface BlastCustomer {
  id: string
  phone: string
}

/**
 * Sends `body` (already sanitised) to each customer, marks sms_awaiting and
 * increments offers_received for successful sends. Never throws — per-customer
 * failures are collected, not fatal.
 */
export async function sendBlastWave(
  sb: SB,
  customers: BlastCustomer[],
  body: string
): Promise<{ sent: number; failures: string[] }> {
  let sent = 0
  const failures: string[] = []
  const recipientIds: string[] = []

  for (const customer of customers) {
    try {
      await twilioClient.messages.create({
        to: customer.phone,
        from: process.env.TWILIO_PHONE_NUMBER!,
        body,
      })
      sent++
      recipientIds.push(customer.id)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[text-blast] failed for ${customer.phone}:`, msg)
      failures.push(customer.phone)
    }
  }

  if (recipientIds.length > 0) {
    await sb.from('customers').update({ sms_awaiting: 'offer' }).in('id', recipientIds)
    await Promise.all(
      recipientIds.map((cid) => sb.rpc('increment_offers_received', { customer_id: cid }))
    )
  }

  return { sent, failures }
}
