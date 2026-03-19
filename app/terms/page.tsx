export const metadata = {
  title: 'Terms & Conditions — The Cellar Club',
}

export default function TermsPage() {
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

        <h1 className="font-serif text-3xl text-cream mb-2">Terms &amp; Conditions</h1>
        <p className="font-sans text-sm text-cream/35 mb-12">Last updated: 18 March 2026</p>

        <section className="mb-8">
          <h2 className="font-serif text-lg text-cream mb-3">1. The service</h2>
          <p className="font-sans text-cream/60 leading-relaxed">
            The Cellar Club is operated by <strong className="text-cream/80">CD WINES LTD</strong>, a company registered in
            England and Wales (company number 15796479). We offer a curated wine subscription
            delivered by SMS: we send you text messages describing wines, you reply to order, and
            we handle everything else. By signing up you agree to these terms in full.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-serif text-lg text-cream mb-3">2. How ordering works</h2>
          <p className="font-sans text-cream/60 leading-relaxed mb-3">
            When we have a wine offer available, we send you a text describing the wine and its
            price per bottle. To place an order, reply with the number of bottles you want (for
            example, <em className="italic text-cream/70">2</em>). Your saved payment card is charged automatically for the total
            amount.
          </p>
          <p className="font-sans text-cream/60 leading-relaxed">
            Orders are binding once placed. By replying with a quantity you are entering into a
            contract to purchase that number of bottles at the advertised price. You may not cancel
            an order after it has been confirmed.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-serif text-lg text-cream mb-3">3. Pricing</h2>
          <p className="font-sans text-cream/60 leading-relaxed">
            The price per bottle is advertised in each offer text. All prices are in GBP and include
            VAT at the applicable rate. Your card is charged in GBP. We reserve the right to change
            prices between offers; the price you pay is always the price stated in the offer text
            you replied to.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-serif text-lg text-cream mb-3">4. Your cellar</h2>
          <p className="font-sans text-cream/60 leading-relaxed mb-3">
            Bottles you purchase are held by us in your virtual cellar. Once your cellar reaches
            12 bottles, we will send you a text with a link to confirm your delivery address, and
            we will ship your full case free of charge.
          </p>
          <p className="font-sans text-cream/60 leading-relaxed">
            If you would like your bottles shipped before you reach 12, you may request an early
            shipment for a flat fee of <span className="text-cream/80">&pound;15</span>. Contact us at{' '}
            <a href="mailto:hello@crushwines.co" className="text-cream/70 underline underline-offset-2 hover:text-cream">
              hello@crushwines.co
            </a>{' '}
            to arrange this.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-serif text-lg text-cream mb-3">5. Cancellation</h2>
          <p className="font-sans text-cream/60 leading-relaxed mb-3">
            You can unsubscribe from The Cellar Club at any time by texting <strong className="text-cream/80">STOP</strong>{' '}
            in reply to any of our messages, or by emailing{' '}
            <a href="mailto:hello@crushwines.co" className="text-cream/70 underline underline-offset-2 hover:text-cream">
              hello@crushwines.co
            </a>
            .
          </p>
          <p className="font-sans text-cream/60 leading-relaxed">
            Cancelling your subscription stops future offer texts and charges. Any bottles already
            held in your cellar at the time of cancellation remain yours. Contact us after
            cancelling to arrange shipment of any remaining bottles; the standard early-shipment fee
            of <span className="text-cream/80">&pound;15</span> applies unless your cellar already holds 12 or more bottles.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-serif text-lg text-cream mb-3">6. Age requirement</h2>
          <p className="font-sans text-cream/60 leading-relaxed">
            You must be 18 years of age or over and a UK resident to use this service. By signing
            up you confirm that you meet these requirements. We will not knowingly provide the
            service to anyone under 18. If we discover that a customer is under 18 we will
            immediately close their account and arrange a refund of any amounts paid.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-serif text-lg text-cream mb-3">7. Alcohol licence</h2>
          <p className="font-sans text-cream/60 leading-relaxed">
            CD WINES LTD holds Premises Licence <strong className="text-cream/80">DCCC/PLA0856</strong> issued under the
            Licensing Act 2003. The sale of alcohol is regulated under that licence. We do not sell
            alcohol to anyone under 18 years of age. Please drink responsibly.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-serif text-lg text-cream mb-3">8. Limitation of liability</h2>
          <p className="font-sans text-cream/60 leading-relaxed mb-3">
            Nothing in these terms limits or excludes our liability for death or personal injury
            caused by our negligence, fraud, or any other liability that cannot be excluded by law.
          </p>
          <p className="font-sans text-cream/60 leading-relaxed">
            To the maximum extent permitted by applicable law, CD WINES LTD is not liable for any
            indirect, incidental, or consequential losses arising out of or in connection with your
            use of the service. Our total aggregate liability to you in respect of any claim is
            limited to the total amount you have paid to us in the 12 months immediately preceding
            the date on which the claim arises.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-serif text-lg text-cream mb-3">9. Governing law</h2>
          <p className="font-sans text-cream/60 leading-relaxed">
            These terms are governed by the laws of England and Wales. Any disputes arising under
            or in connection with these terms shall be subject to the exclusive jurisdiction of the
            courts of England and Wales.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-serif text-lg text-cream mb-3">10. Contact</h2>
          <p className="font-sans text-cream/60 leading-relaxed">
            For any questions about these terms or the service, email us at{' '}
            <a href="mailto:hello@crushwines.co" className="text-cream/70 underline underline-offset-2 hover:text-cream">
              hello@crushwines.co
            </a>
            .
          </p>
        </section>

        <hr className="border-cream/10 mb-8" />

        <p className="font-sans text-sm text-cream/30">
          CD WINES LTD &middot; Company No. 15796479 &middot; Licence DCCC/PLA0856 &middot;{' '}
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
