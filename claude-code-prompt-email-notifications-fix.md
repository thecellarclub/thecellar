# Claude Code Prompt — Email Notification Bug Fix

Emails are not being sent to hello@crushwines.co when customers send REQUEST or QUESTION messages. Diagnose and fix.

---

## Diagnosis steps

1. **Find the email sending code.** Look in:
   - `src/app/api/webhooks/twilio/inbound/route.ts` — where REQUEST and QUESTION are handled
   - Any shared email utility (e.g. `src/lib/email.ts` or similar)

2. **Check Resend initialisation.** The Resend client was previously fixed to use lazy initialisation (not at module load time). Confirm it's being initialised correctly inside the function, not at the top of the file.

3. **Check the `RESEND_API_KEY` env var.** If it's not set in `.env.local` and Vercel, the send will silently fail. Add a check: if `!process.env.RESEND_API_KEY`, log a clear error.

4. **Check the `from` address.** Resend requires the `from` domain to be verified. The from address is likely `noreply@thecellar.club` or similar. If that domain isn't verified in Resend, emails will fail. Check and either:
   - Verify the domain in the Resend dashboard (DNS records), OR
   - Use Resend's sandbox `from` address (`onboarding@resend.dev`) temporarily for testing

5. **Check error handling.** Currently the email send is likely fire-and-forget with no error logging. If it throws, the error is swallowed. Add proper error logging:
   ```js
   try {
     await resend.emails.send({ ... })
   } catch (err) {
     console.error('Failed to send email notification:', err)
     // Do NOT throw — email failure should not break the SMS response
   }
   ```

---

## Fix

Once the root cause is identified, apply the fix. The most likely issues are:

**Issue A — Resend domain not verified:**
- Add note in the code: the from address must be a verified domain in Resend
- Switch `from` to `onboarding@resend.dev` for now so it works immediately
- Document the domain verification step as a TODO comment

**Issue B — RESEND_API_KEY missing from Vercel:**
- Confirm the key is set in Vercel → Settings → Environment Variables
- Add a startup check or clear log if key is missing

**Issue C — Email send not being awaited / in wrong scope:**
- Ensure `await resend.emails.send(...)` is properly awaited
- Ensure it's called in both the REQUEST and QUESTION branches (not just one)

---

## Email content to send (if not already correct)

**REQUEST notification to hello@crushwines.co:**
```
Subject: New special request from [customer first_name]
Body:
[customer first_name] ([customer phone]) sent a special request:

"[message]"

View and manage it in the admin panel:
[NEXT_PUBLIC_APP_URL]/admin/requests
```

**QUESTION notification to hello@crushwines.co:**
```
Subject: New question from [customer first_name]
Body:
[customer first_name] ([customer phone]) has a question:

"[message]"

Reply in the admin panel:
[NEXT_PUBLIC_APP_URL]/admin/concierge
```

---

## After fixing

Test end-to-end:
1. Text REQUEST [message] from a test number → confirm email arrives at hello@crushwines.co
2. Text QUESTION [message] → confirm email arrives
3. Confirm the customer still receives the correct SMS reply in both cases
4. Confirm failed email send does NOT break the SMS response

---

*Ref: winetexts-build-spec.md Section 11 (Email notifications)*
