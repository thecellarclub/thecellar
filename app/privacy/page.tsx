export const metadata = {
  title: 'Privacy Policy — The Cellar Club',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-maroon px-4 py-16">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <a href="/" className="font-sans text-cream/40 hover:text-cream/70 text-xs mb-8 inline-block">← Back</a>

        {/* Brand mark */}
        <div className="text-center mb-12">
          <div className="font-serif text-cream">
            <span className="block text-xs uppercase tracking-[0.3em] text-cream/60">the</span>
            <span className="block text-3xl uppercase tracking-[0.08em] leading-none">CELLAR</span>
            <span className="block text-xs uppercase tracking-[0.3em] text-cream/60">club</span>
          </div>
        </div>

        <h1 className="font-serif text-3xl text-cream mb-2">Privacy Policy</h1>
        <p className="font-sans text-sm text-cream/35 mb-12">Last updated: 18 March 2026</p>

        <section className="mb-8">
          <h2 className="font-serif text-lg text-cream mb-3">1. Who we are</h2>
          <p className="font-sans text-cream/60 leading-relaxed">
            The Cellar Club is operated by <strong className="text-cream/80">CD WINES LTD</strong>, a company registered in England
            and Wales (company number 15796479). If you have any questions about this policy or your
            personal data, please contact us at{' '}
            <a href="mailto:hello@crushwines.co" className="text-cream/70 underline underline-offset-2 hover:text-cream">
              hello@crushwines.co
            </a>
            .
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-serif text-lg text-cream mb-3">2. What data we collect</h2>
          <p className="font-sans text-cream/60 leading-relaxed mb-3">
            When you sign up for The Cellar Club we collect the following personal information:
          </p>
          <ul className="list-disc list-inside space-y-1 font-sans text-cream/60">
            <li>First name</li>
            <li>Mobile phone number</li>
            <li>Email address</li>
            <li>Date of birth (for age verification)</li>
            <li>
              Payment details — your card is tokenised and stored securely by Stripe. We never see or
              store your full card number.
            </li>
          </ul>
          <p className="font-sans text-cream/60 leading-relaxed mt-3">
            We also collect records of your orders, cellar holdings, and shipments as part of
            providing the service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-serif text-lg text-cream mb-3">3. Why we collect it</h2>
          <ul className="list-disc list-inside space-y-1 font-sans text-cream/60">
            <li>To operate your Cellar Club account and fulfil your orders</li>
            <li>To process payments for bottles you have ordered</li>
            <li>To verify that you are 18 or over, as required by law</li>
            <li>
              To send you wine offer texts by SMS — you give explicit consent to this at sign-up and
              can withdraw it at any time
            </li>
            <li>To comply with our legal and regulatory obligations</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="font-serif text-lg text-cream mb-3">4. Who we share it with</h2>
          <p className="font-sans text-cream/60 leading-relaxed mb-3">
            We do not sell your personal data to any third party. We share data only with the
            following processors, each of whom is GDPR compliant:
          </p>
          <ul className="list-disc list-inside space-y-1 font-sans text-cream/60">
            <li>
              <strong className="text-cream/80">Stripe</strong> — payment processing and secure card storage
            </li>
            <li>
              <strong className="text-cream/80">Twilio</strong> — SMS delivery of offer texts and order confirmations
            </li>
          </ul>
          <p className="font-sans text-cream/60 leading-relaxed mt-3">
            Each processor acts only on our instructions and under data processing agreements that
            meet UK GDPR requirements.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-serif text-lg text-cream mb-3">5. How long we keep it</h2>
          <ul className="list-disc list-inside space-y-2 font-sans text-cream/60">
            <li>
              <strong className="text-cream/80">Active customers:</strong> for the duration of your membership plus 7 years
              thereafter, to meet our financial record-keeping obligations.
            </li>
            <li>
              <strong className="text-cream/80">Unsubscribed customers:</strong> your account is anonymised within 2 years of
              unsubscribing, retaining only aggregate transactional data required for accounting.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="font-serif text-lg text-cream mb-3">6. Your rights</h2>
          <p className="font-sans text-cream/60 leading-relaxed mb-3">
            Under UK GDPR you have the right to:
          </p>
          <ul className="list-disc list-inside space-y-1 font-sans text-cream/60">
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate data</li>
            <li>Request erasure of your data (subject to legal retention requirements)</li>
            <li>Restrict or object to how we process your data</li>
            <li>Withdraw your consent to marketing texts at any time (text STOP)</li>
          </ul>
          <p className="font-sans text-cream/60 leading-relaxed mt-3">
            To exercise any of these rights, email{' '}
            <a href="mailto:hello@crushwines.co" className="text-cream/70 underline underline-offset-2 hover:text-cream">
              hello@crushwines.co
            </a>
            . We will respond within 30 days. You also have the right to lodge a complaint with the
            Information Commissioner&apos;s Office at{' '}
            <a
              href="https://ico.org.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cream/70 underline underline-offset-2 hover:text-cream"
            >
              ico.org.uk
            </a>
            .
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-serif text-lg text-cream mb-3">7. Lawful basis for processing</h2>
          <p className="font-sans text-cream/60 leading-relaxed">
            We process your personal data on the following bases:
          </p>
          <ul className="list-disc list-inside space-y-1 font-sans text-cream/60 mt-3">
            <li>
              <strong className="text-cream/80">Contractual necessity</strong> — to fulfil your orders and operate your account
            </li>
            <li>
              <strong className="text-cream/80">Legitimate interests</strong> — to maintain accurate business records and
              prevent fraud
            </li>
            <li>
              <strong className="text-cream/80">Explicit consent</strong> — to send you marketing texts; this consent is
              obtained at sign-up and can be withdrawn at any time by texting STOP or emailing us
            </li>
            <li>
              <strong className="text-cream/80">Legal obligation</strong> — to retain financial records and comply with
              licensing requirements
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="font-serif text-lg text-cream mb-3">8. Governing law</h2>
          <p className="font-sans text-cream/60 leading-relaxed">
            This policy is governed by UK GDPR and the Data Protection Act 2018. CD WINES LTD is
            the data controller for the purposes of that legislation.
          </p>
        </section>

        <hr className="border-cream/10 mb-8" />

        <p className="font-sans text-sm text-cream/30">
          CD WINES LTD &middot; Company No. 15796479 &middot;{' '}
          <a href="mailto:hello@crushwines.co" className="text-cream/70 underline underline-offset-2 hover:text-cream">
            hello@crushwines.co
          </a>
        </p>

        <div className="flex gap-4 mt-4">
          <a href="/privacy" className="font-sans text-cream/30 hover:text-cream/60 text-xs underline underline-offset-2">Privacy</a>
          <a href="/terms" className="font-sans text-cream/30 hover:text-cream/60 text-xs underline underline-offset-2">Terms</a>
        </div>
      </div>
    </main>
  )
}
