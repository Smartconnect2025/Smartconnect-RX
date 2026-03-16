import { SimplifiedHeader } from "@/components/layout/SimplifiedHeader";

export default function TelemedicineConsentPage() {
  return (
    <>
      <SimplifiedHeader />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-white rounded-[4px] shadow-sm border border-gray-200 p-8">
            <h1 className="text-3xl font-bold text-[#1E3A8A] mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>
              Telemedicine Informed Consent
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
                  Telemedicine involves the delivery of healthcare services using electronic communications, information technology, or other means between a healthcare provider and a patient who are not in the same physical location. This may include consultation, treatment, transfer of medical data, emails, telephone conversations, and video conferencing.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  2. Nature of Telemedicine Services
                </h2>
                <p>
                  By consenting to telemedicine services through AIM Medical Technologies, you understand that:
                </p>
                <ul className="list-disc pl-6 mt-2 space-y-2">
                  <li>Healthcare services will be provided remotely using secure telecommunications technology.</li>
                  <li>Your provider will review your medical history, symptoms, and any relevant information you provide.</li>
                  <li>Prescriptions may be issued electronically based on the clinical evaluation conducted via telemedicine.</li>
                  <li>AimRX is a technology platform and is not itself a licensed healthcare provider.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  3. Benefits and Risks
                </h2>
                <p className="mb-2">
                  <strong>Benefits</strong> may include improved access to healthcare services, convenience, and reduced travel time.
                </p>
                <p>
                  <strong>Risks</strong> may include limitations in the provider&apos;s ability to perform a physical examination, potential technology failures, and the possibility that the provider may determine telemedicine is not appropriate for your condition and may recommend an in-person visit.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  4. Privacy and Security
                </h2>
                <p>
                  All telemedicine interactions are conducted in compliance with HIPAA and applicable state and federal privacy laws. While we use encrypted, secure communication channels, no electronic communication is entirely risk-free. We take reasonable steps to protect your personal health information.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  5. Patient Rights
                </h2>
                <ul className="list-disc pl-6 space-y-2">
                  <li>You have the right to withdraw consent for telemedicine services at any time.</li>
                  <li>You have the right to request an in-person visit with a healthcare provider.</li>
                  <li>You have the right to access your medical records generated during telemedicine encounters.</li>
                  <li>You may refuse any recommended treatment or prescription.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  6. Emergency Situations
                </h2>
                <p>
                  Telemedicine is not appropriate for emergency situations. If you are experiencing a medical emergency, call 911 or go to the nearest emergency room immediately.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  7. Consent
                </h2>
                <p>
                  By using the telemedicine services available through AIM Medical Technologies, you acknowledge that you have read, understand, and agree to the terms described in this consent form. You consent to receive healthcare services via telemedicine and understand the limitations and risks involved.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  8. Contact Information
                </h2>
                <p>
                  If you have questions about this consent or our telemedicine services, please contact us at (512) 377-9898 or visit us at 106 E 6th St, Suite 900, Austin, TX 78701.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
