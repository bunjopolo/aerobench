export const TermsOfService = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-dark-bg text-gray-300 p-8">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={onBack}
          className="mb-6 text-brand-primary hover:text-indigo-400 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to App
        </button>

        <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-gray-500 mb-8">Last updated: February 16, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By using AeroBench, you agree to these Terms. If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Service Description</h2>
            <p>
              AeroBench provides cycling analysis tools (including virtual elevation) and course simulation.
              Features may change over time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Accounts</h2>
            <p>
              You are responsible for your account and activity under it. We may suspend or close accounts for abuse,
              fraud, or Terms violations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Your Content and Data</h2>
            <p>
              You keep ownership of content and data you provide. You grant us a limited right to use it only to run
              and improve AeroBench.
            </p>
            <p className="mt-2">
              You confirm you have permission to upload or use any data you submit.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li>Break laws or violate others' rights</li>
              <li>Attempt unauthorized access to the app or infrastructure</li>
              <li>Upload malicious code or disrupt service operations</li>
              <li>Use the app to harass, abuse, or defraud others</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Results Disclaimer</h2>
            <p className="bg-yellow-900/30 border border-yellow-600/50 rounded p-4">
              <strong className="text-yellow-300">Important:</strong> AeroBench outputs are estimates based on models
              and input quality. They are provided for informational use and are not guaranteed to be accurate for all
              conditions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Service Availability</h2>
            <p>
              The service is provided "as is" and "as available." We do not guarantee uninterrupted or error-free
              operation.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Limitation of Liability</h2>
            <p>
              To the maximum extent allowed by law, AeroBench is not liable for indirect, incidental, special, or
              consequential damages arising from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Changes and Termination</h2>
            <p>
              We may update, suspend, or discontinue parts of AeroBench at any time. We may update these Terms by
              posting a revised version on this page.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Contact</h2>
            <p>
              Questions about these Terms can be submitted through the Contact form in the app.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-dark-border text-center text-gray-500 text-xs">
          <p>&copy; {new Date().getFullYear()} AeroBench. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
