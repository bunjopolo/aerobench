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
        <p className="text-gray-500 mb-8">Last updated: January 2025</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Introduction</h2>
            <p>
              Welcome to AeroBench ("we," "our," or "us"). We are committed to protecting your privacy 
              and personal data. This Privacy Policy explains how we collect, use, store, and protect 
              your information when you use our cycling aerodynamics analysis application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Information We Collect</h2>
            
            <h3 className="text-lg font-medium text-gray-200 mt-4 mb-2">2.1 Account Information</h3>
            <p>When you sign in using Google or GitHub, we receive:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li>Your email address</li>
              <li>Your display name</li>
              <li>Your profile picture (if available)</li>
              <li>A unique user identifier from the authentication provider</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-200 mt-4 mb-2">2.2 Cycling Data</h3>
            <p>When you use our analysis features, we collect:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li><strong>GPX File Data:</strong> GPS coordinates, elevation, timestamps, power data, speed, and cadence from your cycling activities</li>
              <li><strong>Equipment Setups:</strong> Bike names, wheel types, tire types, position notes, and aerodynamic values (CdA, Crr) you save</li>
              <li><strong>Analysis Results:</strong> Calculated aerodynamic coefficients, RMSE values, wind conditions, and notes</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-200 mt-4 mb-2">2.3 Technical Data</h3>
            <p>We automatically collect:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li>Browser type and version</li>
              <li>Device information</li>
              <li>IP address</li>
              <li>Usage patterns and feature interactions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li>Provide and maintain the AeroBench service</li>
              <li>Authenticate your identity and secure your account</li>
              <li>Store and display your equipment setups and analysis history</li>
              <li>Calculate and track your aerodynamic performance over time</li>
              <li>Improve our application and develop new features</li>
              <li>Respond to your requests or questions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Data Storage and Security</h2>
            <p>
              Your data is stored securely using Supabase, a trusted cloud database provider. We implement 
              industry-standard security measures including:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li>Encrypted data transmission (HTTPS/TLS)</li>
              <li>Row-level security policies ensuring you can only access your own data</li>
              <li>Secure authentication via OAuth 2.0 (Google and GitHub)</li>
              <li>Regular security updates and monitoring</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Third-Party Services</h2>
            <p>We use the following third-party services:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li><strong>Supabase:</strong> Database hosting and user authentication</li>
              <li><strong>Google:</strong> OAuth authentication (when you sign in with Google)</li>
              <li><strong>GitHub:</strong> OAuth authentication (when you sign in with GitHub)</li>
              <li><strong>Open-Meteo:</strong> Historical weather data for wind conditions (only GPS coordinates and date are sent)</li>
              <li><strong>Vercel:</strong> Application hosting</li>
            </ul>
            <p className="mt-2">
              Each of these services has their own privacy policies. We encourage you to review them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Data Sharing</h2>
            <p>We do not sell, trade, or rent your personal information. We may share data only:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li>With service providers necessary to operate AeroBench (as listed above)</li>
              <li>If required by law or legal process</li>
              <li>To protect our rights, privacy, safety, or property</li>
              <li>With your explicit consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li><strong>Access:</strong> Request a copy of the data we hold about you</li>
              <li><strong>Correction:</strong> Update or correct inaccurate data</li>
              <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
              <li><strong>Portability:</strong> Export your data in a usable format</li>
              <li><strong>Objection:</strong> Object to certain processing of your data</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, please contact us using the information below.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. If you delete your account, 
              we will delete your personal data within 30 days, except where we are required to retain 
              it for legal or legitimate business purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. International Data Transfers</h2>
            <p>
              Your data may be transferred to and processed in countries other than your own. 
              We ensure appropriate safeguards are in place to protect your data in accordance 
              with applicable laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Children's Privacy</h2>
            <p>
              AeroBench is not intended for children under 16 years of age. We do not knowingly 
              collect personal information from children under 16. If you believe we have collected 
              such information, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any 
              significant changes by posting the new policy on this page and updating the 
              "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">12. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our data practices, 
              please contact us at:
            </p>
            <p className="mt-2 text-brand-primary">support@aerobench.app</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-dark-border text-center text-gray-500 text-xs">
          <p>&copy; {new Date().getFullYear()} AeroBench. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
