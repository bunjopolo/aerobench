export const PrivacyPolicy = ({ onBack }) => {
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

        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-8">Last updated: February 16, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Overview</h2>
            <p>
              This policy explains what AeroBench collects, what we do with it, and what we do not store.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Data We Collect</h2>
            <p>When you use AeroBench, we collect:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li>Account details from sign-in (email, name, avatar, and account ID)</li>
              <li>Data you choose to save (studies, configurations, run results, simulator presets, and notes)</li>
              <li>Saved run metadata (for example file name and ride date)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Data We Do Not Store</h2>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li>Raw GPX/FIT file contents</li>
              <li>Full GPS track traces from your uploaded files</li>
            </ul>
            <p className="mt-2">
              Uploaded ride files are processed in your browser for analysis.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. How We Use Data</h2>
            <p>We use saved data to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li>Run your account and save your work</li>
              <li>Display your studies and results</li>
              <li>Provide support and improve the app</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Third-Party Services</h2>
            <p>We use:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li>Supabase (database and authentication)</li>
              <li>Google (sign-in)</li>
              <li>Open-Meteo (weather lookup when you choose Fetch Weather)</li>
              <li>Vercel (hosting)</li>
            </ul>
            <p className="mt-2">
              For weather lookup, the selected location and date are sent to Open-Meteo.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Data Sharing and Sales</h2>
            <p>
              We do not sell your personal data. We only share data with service providers needed to run the app,
              or when required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Data Retention and Deletion</h2>
            <p>
              We keep your saved account data while your account is active. You can request account deletion, and we
              will remove your data except where retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Security</h2>
            <p>
              We use reasonable safeguards (including HTTPS and authenticated access controls) to protect your data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Changes to This Policy</h2>
            <p>
              We may update this policy. Any updates will be posted on this page with a new "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Contact Us</h2>
            <p>
              If you have questions about privacy or want to request data deletion, use the Contact form in the app.
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
