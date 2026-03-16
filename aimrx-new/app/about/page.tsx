import { SimplifiedHeader } from "@/components/layout/SimplifiedHeader";
import { Shield, Cpu, Users, HeartPulse } from "lucide-react";

export default function AboutPage() {
  return (
    <>
      <SimplifiedHeader />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-white rounded-[4px] shadow-sm border border-gray-200 p-8">
            <h1 className="text-3xl font-bold text-[#1E3A8A] mb-6" style={{ fontFamily: 'Inter, sans-serif' }}>
              About AIM Medical Technologies
            </h1>

            <div className="space-y-8 text-gray-700" style={{ fontFamily: 'Inter, sans-serif' }}>
              <section>
                <p className="text-lg leading-relaxed">
                  AIM Medical Technologies is a healthcare technology company headquartered in Austin, Texas. We build tools that connect patients, providers, and pharmacies — making prescriptions, consultations, and medication management simpler and more accessible.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  Our Mission
                </h2>
                <p>
                  To elevate patient care with AI-driven clinical innovations. We believe healthcare should be efficient, transparent, and accessible to everyone — regardless of location or circumstance.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-4">
                  What We Do
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <HeartPulse className="w-5 h-5 text-[#1E3A8A]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Telemedicine</h3>
                      <p className="text-sm">Connecting patients with licensed providers through secure virtual consultations.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Cpu className="w-5 h-5 text-[#1E3A8A]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">E-Prescribing</h3>
                      <p className="text-sm">Streamlining the prescription process from provider to pharmacy with electronic prescriptions.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-[#1E3A8A]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Pharmacy Marketplace</h3>
                      <p className="text-sm">A marketplace connecting patients with pharmacies for competitive pricing and convenient fulfillment.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Shield className="w-5 h-5 text-[#1E3A8A]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">HIPAA Compliant</h3>
                      <p className="text-sm">All patient data is encrypted and secured in compliance with federal privacy standards.</p>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-[#1E3A8A] mb-3">
                  Contact Us
                </h2>
                <div className="bg-gray-50 rounded-lg p-6 space-y-2">
                  <p className="font-semibold text-gray-900">AIM Medical Technologies</p>
                  <p>106 E 6th St, Suite 900</p>
                  <p>Austin, TX 78701</p>
                  <p className="pt-2">Phone: (512) 377-9898</p>
                  <p className="text-sm text-gray-500">Mon&ndash;Fri 9AM&ndash;6PM CST</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
