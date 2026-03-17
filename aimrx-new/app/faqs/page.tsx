import { SimplifiedHeader } from "@/components/layout/SimplifiedHeader";

const faqs = [
  {
    question: "What is SmartConnect RX?",
    answer: "SmartConnect RX is a healthcare technology marketplace that connects patients, providers, and pharmacies. Our platform enables telemedicine consultations, electronic prescriptions, and convenient medication fulfillment — all in one place.",
  },
  {
    question: "Is SmartConnect RX a healthcare provider?",
    answer: "No. SmartConnect RX is a technology platform, not a licensed healthcare provider. We connect you with licensed healthcare providers who deliver medical consultations and prescriptions through our platform.",
  },
  {
    question: "How do telemedicine consultations work?",
    answer: "After creating an account, you can book a virtual consultation with a licensed provider. During the consultation, your provider will review your medical history, discuss your symptoms, and may prescribe medications electronically if appropriate.",
  },
  {
    question: "Is my personal health information secure?",
    answer: "Yes. Our platform is fully HIPAA compliant. All patient data is encrypted and stored securely in compliance with federal privacy standards. We use industry-standard security measures to protect your information.",
  },
  {
    question: "How do prescriptions work on SmartConnect RX?",
    answer: "When a provider issues a prescription through our platform, it is sent electronically to a pharmacy. You can choose from available pharmacies in our marketplace for competitive pricing and convenient fulfillment options, including delivery.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept major credit and debit cards through our secure payment processing system. Payment details are never stored on our servers and are handled by PCI-compliant payment processors.",
  },
  {
    question: "Can I get a refund?",
    answer: "Please review our Refund Policy for detailed information about our refund process. Refund eligibility depends on the type of service and the stage of fulfillment.",
  },
  {
    question: "What if I have a medical emergency?",
    answer: "SmartConnect RX and telemedicine services are not intended for medical emergencies. If you are experiencing a medical emergency, call 911 or go to your nearest emergency room immediately.",
  },
  {
    question: "How do I contact support?",
    answer: "You can reach our support team by calling (512) 377-9898, Monday through Friday, 9AM to 6PM CST. Our office is located at 106 E 6th St, Suite 900, Austin, TX 78701.",
  },
  {
    question: "Do I need to create an account?",
    answer: "Yes. An account is required to access telemedicine consultations, view prescriptions, and manage your health information on our platform. Creating an account ensures your data is securely stored and accessible only to you and your providers.",
  },
];

export default function FAQsPage() {
  return (
    <>
      <SimplifiedHeader />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-white rounded-[4px] shadow-sm border border-gray-200 p-8">
            <h1 className="text-3xl font-bold text-[#1E3A8A] mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
              Frequently Asked Questions
            </h1>
            <p className="text-gray-500 mb-8" style={{ fontFamily: 'Inter, sans-serif' }}>
              Find answers to common questions about SmartConnect RX and our services.
            </p>

            <div className="space-y-6" style={{ fontFamily: 'Inter, sans-serif' }}>
              {faqs.map((faq, index) => (
                <div key={index} className="border-b border-gray-100 pb-6 last:border-0 last:pb-0" data-testid={`faq-item-${index}`}>
                  <h2 className="text-lg font-semibold text-[#1E3A8A] mb-2">
                    {faq.question}
                  </h2>
                  <p className="text-gray-700 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
