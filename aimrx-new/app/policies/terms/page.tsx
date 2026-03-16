import { SimplifiedHeader } from "@/components/layout/SimplifiedHeader";

export default function TermsPage() {
  return (
    <>
      <SimplifiedHeader />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-white rounded-[4px] shadow-sm border border-gray-200 p-8">
            <h1 className="text-3xl font-bold text-[#1E3A8A] mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>
              Terms and Conditions
            </h1>

            <div className="space-y-6 text-gray-700" style={{ fontFamily: 'Inter, sans-serif' }}>
              <p className="text-sm text-gray-500">
                Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  1. Acceptance of Terms
                </h2>
                <p>
                  By accessing and using this e-prescribing platform, you accept and agree to be bound by the terms and provisions of this agreement.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  2. Use License
                </h2>
                <p>
                  [Add your use license terms here. For example: Permission is granted to temporarily access the services provided on this platform for personal, non-commercial transitory use only.]
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  3. User Responsibilities
                </h2>
                <p>
                  [Add user responsibility terms here. For example: Users are responsible for maintaining the confidentiality of their account credentials and for all activities that occur under their account.]
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  4. Medical Disclaimer
                </h2>
                <p>
                  [Add medical disclaimer here. For example: This platform facilitates communication between healthcare providers and patients but does not provide medical advice. Always consult with a qualified healthcare provider for medical concerns.]
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  5. Privacy and Data Protection
                </h2>
                <p>
                  Your use of this platform is also governed by our Privacy Policy. We are committed to protecting your personal health information in accordance with HIPAA regulations.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  6. Prescription Services
                </h2>
                <p>
                  [Add prescription service terms here. For example: All prescriptions are issued at the discretion of licensed healthcare providers. Not all medications may be available through our platform.]
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  7. Limitation of Liability
                </h2>
                <p>
                  [Add liability limitations here. For example: In no event shall the platform or its providers be liable for any damages arising out of the use or inability to use the services.]
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  8. Modifications to Terms
                </h2>
                <p>
                  [Add modification terms here. For example: We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting to the platform.]
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  9. Governing Law
                </h2>
                <p>
                  [Add governing law information here. For example: These terms shall be governed by and construed in accordance with the laws of [Your State/Country].]
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  10. Contact Information
                </h2>
                <p>
                  If you have any questions about these Terms and Conditions, please contact us at:
                </p>
                <p className="mt-2">
                  Email: [your-email@example.com]<br />
                  Phone: [your-phone-number]
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
