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
        <p className="text-gray-500 mb-8">Last updated: January 2025</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using AeroBench ("the Service"), you agree to be bound by these Terms of 
              Service ("Terms"). If you do not agree to these Terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
            <p>
              AeroBench is a web application that provides cycling aerodynamics analysis using the 
              Chung Method (Virtual Elevation). The Service allows users to:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li>Upload and analyze GPX files from cycling activities</li>
              <li>Calculate aerodynamic coefficients (CdA and Crr)</li>
              <li>Save and track equipment setups</li>
              <li>View analysis history and performance trends</li>
              <li>Estimate speed and power requirements</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. User Accounts</h2>
            <p>
              To use the Service, you must create an account using Google or GitHub authentication. 
              You are responsible for:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li>Maintaining the security of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized access</li>
            </ul>
            <p className="mt-2">
              We reserve the right to suspend or terminate accounts that violate these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li>Use the Service for any illegal purpose or in violation of any laws</li>
              <li>Attempt to gain unauthorized access to the Service or its systems</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Upload malicious files or code</li>
              <li>Use automated systems to access the Service without permission</li>
              <li>Impersonate any person or entity</li>
              <li>Collect or harvest user data without consent</li>
              <li>Use the Service to harm, harass, or defraud others</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Your Data</h2>
            <p>
              You retain ownership of all data you upload to the Service, including GPX files, 
              equipment setups, and analysis results. By using the Service, you grant us a 
              limited license to store, process, and display your data solely to provide the Service.
            </p>
            <p className="mt-2">
              You are responsible for ensuring you have the right to upload any data to the Service 
              and that such data does not infringe on third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Accuracy of Calculations</h2>
            <p className="bg-yellow-900/30 border border-yellow-600/50 rounded p-4">
              <strong className="text-yellow-300">Important Disclaimer:</strong> The aerodynamic 
              calculations provided by AeroBench are estimates based on mathematical models. 
              Results depend on data quality, environmental conditions, and various assumptions. 
              These calculations should not be used as the sole basis for equipment purchases, 
              race strategies, or safety-critical decisions. Always use professional testing 
              and expert advice for important decisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Intellectual Property</h2>
            <p>
              The Service, including its design, features, code, and content (excluding user data), 
              is owned by AeroBench and protected by intellectual property laws. You may not copy, 
              modify, distribute, or reverse engineer any part of the Service without our written 
              permission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, 
              EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, 
              FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
            </p>
            <p className="mt-2">We do not warrant that:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li>The Service will be uninterrupted or error-free</li>
              <li>Results obtained from the Service will be accurate or reliable</li>
              <li>Any errors in the Service will be corrected</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, AEROBENCH AND ITS OWNERS, OPERATORS, AND 
              AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, 
              OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR USE, ARISING OUT OF 
              OR RELATED TO YOUR USE OF THE SERVICE.
            </p>
            <p className="mt-2">
              Our total liability for any claims arising from your use of the Service shall not 
              exceed the amount you paid us (if any) in the twelve months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless AeroBench, its owners, and affiliates from 
              any claims, damages, losses, or expenses (including legal fees) arising from:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
              <li>Your use of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any third-party rights</li>
              <li>Any data you upload to the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Modifications to Service</h2>
            <p>
              We reserve the right to modify, suspend, or discontinue the Service (or any part thereof) 
              at any time, with or without notice. We shall not be liable to you or any third party 
              for any modification, suspension, or discontinuation of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">12. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. We will notify you of significant changes 
              by posting the new Terms on this page and updating the "Last updated" date. Your 
              continued use of the Service after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">13. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the 
              jurisdiction in which AeroBench operates, without regard to conflict of law principles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">14. Severability</h2>
            <p>
              If any provision of these Terms is found to be unenforceable or invalid, that provision 
              shall be limited or eliminated to the minimum extent necessary, and the remaining 
              provisions shall remain in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">15. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us at:
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
