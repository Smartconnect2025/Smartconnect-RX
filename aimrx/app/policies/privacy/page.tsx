import { SimplifiedHeader } from "@/components/layout/SimplifiedHeader";

export default function PrivacyPolicyPage() {
  return (
    <>
      <SimplifiedHeader />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-white rounded-[4px] shadow-sm border border-gray-200 p-8">
            <h1 className="text-3xl font-bold text-[#1E3A8A] mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>
              Privacy Policy
            </h1>

            <div className="space-y-6 text-gray-700" style={{ fontFamily: 'Inter, sans-serif' }}>
              <p className="text-sm text-gray-500">
                Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  1. Introduction
                </h2>
                <p>
                  We are committed to protecting your privacy and personal health information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our e-prescribing platform.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  2. HIPAA Compliance
                </h2>
                <p>
                  [Add HIPAA compliance information here. For example: Our platform is fully HIPAA-compliant. We implement administrative, physical, and technical safeguards to protect your Protected Health Information (PHI).]
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  3. Information We Collect
                </h2>
                <p>
                  We collect information that you provide directly to us, including:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Personal identification information (name, email, phone number, date of birth)</li>
                  <li>Medical history and health information</li>
                  <li>Prescription and medication information</li>
                  <li>Payment and billing information</li>
                  <li>Account credentials and preferences</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  4. How We Use Your Information
                </h2>
                <p>
                  [Add information usage details here. For example: We use your information to provide healthcare services, process prescriptions, communicate with you about your care, process payments, and improve our services.]
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  5. Information Sharing and Disclosure
                </h2>
                <p>
                  [Add disclosure information here. For example: We may share your information with healthcare providers, pharmacies, and other entities necessary to provide your care. We will never sell your personal health information.]
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  6. Data Security
                </h2>
                <p>
                  [Add security measures here. For example: We use encryption, secure servers, and regular security audits to protect your information. However, no method of transmission over the Internet is 100% secure.]
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  7. Your Rights
                </h2>
                <p>
                  You have the right to:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
                  <li>Access your personal and health information</li>
                  <li>Request corrections to your information</li>
                  <li>Request deletion of your information (subject to legal requirements)</li>
                  <li>Opt-out of certain communications</li>
                  <li>Receive an accounting of disclosures</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  8. Cookies and Tracking Technologies
                </h2>
                <p>
                  [Add cookie policy here. For example: We use cookies and similar technologies to improve your experience, analyze usage patterns, and maintain session security.]
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  9. Third-Party Services
                </h2>
                <p>
                  [Add third-party service information here. For example: We work with trusted third-party services like payment processors and pharmacy networks. These partners are bound by strict confidentiality agreements.]
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  10. Changes to This Policy
                </h2>
                <p>
                  We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the &quot;Last updated&quot; date.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  11. Contact Us
                </h2>
                <p>
                  If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us at:
                </p>
                <p className="mt-2">
                  Email: [your-email@example.com]<br />
                  Phone: [your-phone-number]<br />
                  Address: [your-physical-address]
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
