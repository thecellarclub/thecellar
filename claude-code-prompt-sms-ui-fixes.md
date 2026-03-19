# Claude Code Prompt — SMS & UI Fixes

Four things. Do them in order.

---

## 1. +44 prefix on phone inputs (customer-facing pages)

On the homepage (`app/page.tsx`) and the join page (`app/join/page.tsx`), replace the raw phone `<input>` with a prefixed version that shows "+44" as a fixed label. This makes it immediately clear it's a UK number and removes ambiguity about format.

### Pattern to use

```tsx
<div className="flex items-stretch border border-cream/30 focus-within:border-cream/60 transition-colors">
  <span className="flex items-center px-3 font-sans text-base text-cream/60 border-r border-cream/20 select-none bg-transparent whitespace-nowrap">
    +44
  </span>
  <input
    type="tel"
    value={phone}
    onChange={(e) => setPhone(e.target.value)}
    placeholder="7700 900000"
    className="flex-1 bg-transparent px-4 py-3 text-cream placeholder-cream/30 focus:outline-none font-sans text-base"
  />
</div>
```

When the form submits, prepend "+44" to the value before passing it to the API — but strip any leading 0 first, so "07826665548" becomes "+447826665548" not "+4407826665548":

```ts
function buildPhone(raw: string): string {
  const stripped = raw.replace(/[\s\-]/g, '')
  if (stripped.startsWith('0')) return '+44' + stripped.slice(1)
  return '+44' + stripped
}
```

Call this in the submit handler before navigating/posting. The `normaliseUKPhone` function on the server will also validate it, so no need to duplicate validation in the UI.

Apply to:
- `app/page.tsx` — the `HeroSignupForm` component
- `app/join/page.tsx` — the phone input on the first join step
- `app/portal/page.tsx` — the `PortalLoginForm` phone input (same pattern, but in the portal design system — dark background, cream text)

---

## 2. OFFER SMS command

Add a new SMS command: if a customer texts OFFER, resend the current active wine offer so they can place or retry an order.

In `app/api/webhooks/twilio/inbound/route.ts`, add a handler before the HELP/unknown catch-all:

```ts
// ── OFFER ────────────────────────────────────────────────────────────────
if (body === 'offer') {
  const { data: activeText } = await sb
    .from('texts')
    .select('id, wines(name, producer, region, vintage, price_pence, stock_bottles, description)')
    .eq('is_active', true)
    .maybeSingle() as { data: { id: string; wines: WineRow } | null }

  if (!activeText || !activeText.wines) {
    await sendSms(from, `There's no active offer right now. We'll text you when the next one is ready.`)
    return twimlOk()
  }

  const w = activeText.wines

  if (!w.stock_bottles || w.stock_bottles <= 0) {
    await sendSms(from, `Sorry — that one sold out. We'll be in touch with the next drop.`)
    return twimlOk()
  }

  const price = `£${(w.price_pence / 100).toFixed(2)}`
  const vintage = w.vintage ? `${w.vintage} ` : ''
  const origin = [w.region].filter(Boolean).join(', ')
  const desc = w.description ? `\n\n${w.description}` : ''

  await sendSms(
    from,
    `This week's offer: ${vintage}${w.name}${origin ? ` (${origin})` : ''} — ${price} per bottle.${desc}\n\nReply with how many bottles you'd like.`
  )
  return twimlOk()
}
```

Also add OFFER to the SMS help menu. In the `HELP` / catch-all menu message (appears twice in the file), add `OFFER — see this week's wine again` between ACCOUNT and REQUEST.

---

## 3. Fix the post-charge Scenario 2 ship message

In `lib/post-charge.ts`, Scenario 2 (exactly 12 bottles — case complete) currently sends:
> "We'll text you a delivery link shortly. Reply SHIP any time to confirm your address."

This is wrong — no link is ever sent separately. Fix it to create a pending shipment immediately and send the link in the same message, exactly like Scenario 3 does.

Replace the entire Scenario 2 block (from `} else if (totalBottles === threshold) {` to the `await sendSms(...)` call within it) with:

```ts
} else if (totalBottles === threshold) {
  // ── Scenario 2: exactly threshold bottles — case complete ─────────────────

  // Build wine list
  const wineCounts: Record<string, number> = {}
  for (const row of rows) {
    wineCounts[row.wine_id] = (wineCounts[row.wine_id] ?? 0) + row.quantity
  }
  const wineIds = Object.keys(wineCounts)
  const { data: wines } = await sb.from('wines').select('id, name').in('id', wineIds)
  const wineMap: Record<string, string> = {}
  for (const w of wines ?? []) { wineMap[w.id] = w.name }
  const wineLines = wineIds
    .map((id) => `${wineCounts[id]}x ${wineMap[id] ?? 'wine'}`)
    .join('\n')

  // Reset case timer
  await sb.from('customers').update({
    case_started_at: null,
    case_nudge_1_sent_at: null,
    case_nudge_2_sent_at: null,
  }).eq('id', customerId)

  // Check for saved address
  const { data: cust } = await sb
    .from('customers')
    .select('default_address')
    .eq('id', customerId)
    .maybeSingle()

  const addr = cust?.default_address as Record<string, string> | null

  if (addr?.line1) {
    // Address saved — ask for YES/CHANGE confirmation, no link needed
    const addrLine = [addr.line1, addr.city, addr.postcode].filter(Boolean).join(', ')

    // Create a pending shipment token anyway (for the SHIP flow if they change address)
    const shipToken = crypto.randomUUID()
    await sb.from('shipments').insert({
      customer_id: customerId,
      status: 'pending',
      token: shipToken,
      bottle_count: threshold,
      shipping_fee_pence: 0,
    })

    await sendSms(
      customerPhone,
      `Your case is complete!\n\n${wineLines}\n\nWe'll ship to: ${addrLine}\n\nReply YES to confirm or SHIP to change your address.`
    )
  } else {
    // No saved address — send the link now
    const shipToken = crypto.randomUUID()
    await sb.from('shipments').insert({
      customer_id: customerId,
      status: 'pending',
      token: shipToken,
      bottle_count: threshold,
      shipping_fee_pence: 0,
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
    await sendSms(
      customerPhone,
      `Your case is complete!\n\n${wineLines}\n\nConfirm your delivery address here: ${appUrl}/ship?token=${shipToken}`
    )
  }
```

---

## 4. Add save-number message to welcome SMS

When a new customer completes signup (in `app/api/signup/complete/route.ts`), they should receive a welcome SMS. Check if one is currently sent. If so, add to it; if not, add a welcome SMS send after the customer insert succeeds:

```ts
await sendSms(phone, `Welcome to The Cellar Club, ${firstName}! Save this number as "The Cellar Club" so you recognise it when we text. Daniel will be in touch with your first drop soon.`)
```

If a welcome SMS already exists, just append the "save this number" instruction to it.

(Import `sendSms` from `@/lib/twilio` if not already imported in that file.)

---

## 5. Build, commit, push

```
npm run build
git add -A
git commit -m "SMS/UI: +44 prefix inputs, OFFER command, ship Scenario 2 fix, save-number welcome"
git push
```
