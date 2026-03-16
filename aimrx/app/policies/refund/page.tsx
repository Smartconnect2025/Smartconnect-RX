import { SimplifiedHeader } from "@/components/layout/SimplifiedHeader";

export default function RefundPolicyPage() {
  return (
    <>
      <SimplifiedHeader />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-white rounded-[4px] shadow-sm border border-gray-200 p-8">
            <h1 className="text-3xl font-bold text-[#1E3A8A] mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>
              Refund Policy
            </h1>

            <div className="space-y-6 text-gray-700" style={{ fontFamily: 'Inter, sans-serif' }}>
              <p className="text-sm text-gray-500">
                Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  Overview
                </h2>
                <p>
                  This refund policy outlines the terms and conditions for refunds on services and products provided through our e-prescribing platform.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  Consultation Fees
                </h2>
                <p>
                  [Add your consultation fee refund policy here. For example: Consultation fees are non-refundable once the consultation has been completed. If a consultation is cancelled at least 24 hours in advance, a full refund will be issued.]
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  Prescription Medications
                </h2>
                <p>
                  [Add your prescription medication refund policy here. For example: Prescription medications cannot be refunded once they have been dispensed by the pharmacy. Please consult with your provider before purchasing.]
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  Subscription Services
                </h2>
                <p>
                  [Add your subscription refund policy here. For example: Monthly subscriptions can be cancelled at any time, but no refunds will be issued for partial months. Annual subscriptions may be refunded on a prorated basis within the first 30 days.]
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  How to Request a Refund
                </h2>
                <p>
                  [Add instructions for requesting refunds here. For example: To request a refund, please contact our support team at support@example.com with your order number and reason for the refund request.]
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  Processing Time
                </h2>
                <p>
                  [Add refund processing timeframe here. For example: Approved refunds will be processed within 5-10 business days and will be credited to the original payment method.]
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  Contact Us
                </h2>
                <p>
                  If you have any questions about our refund policy, please contact us at:
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
