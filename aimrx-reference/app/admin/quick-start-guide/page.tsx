"use client";

import { useState } from "react";
import { Copy, CheckCircle } from "lucide-react";

export const dynamic = 'force-dynamic';

export default function QuickStartGuidePage() {
  const [copiedAim, setCopiedAim] = useState(false);
  const [copiedGrin, setCopiedGrin] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const appUrl = "https://3004.app.specode.ai";

  const copyToClipboard = (text: string, setCopied: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleForceSeed = async () => {
    setSeeding(true);
    try {
      const response = await fetch("/api/admin/force-seed-admins", {
        method: "POST",
      });

      const result = await response.json();

      if (result.success) {
        setSeeded(true);
      } else {
        alert("Failed to force-seed admins: " + result.error);
      }
    } catch (error) {
      console.error("Seed error:", error);
      alert("Error force-seeding admins");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">🚀 Quick Start Guide</h1>
        <p className="text-gray-600 mb-6">Multi-Pharmacy Platform - Stage 1 Complete</p>

        {/* BIG YELLOW WARNING BOX */}
        {seeded ? (
          <div className="border-4 border-green-500 rounded-lg p-8 mb-8" style={{ backgroundColor: "#C8E6C9" }}>
            <h2 className="text-3xl font-bold text-green-900 mb-4 text-center">
              ✅ ALL SEEDED (pharmacies + admins) – ready!
            </h2>
            <p className="text-center text-green-800 text-lg">
              Both pharmacies and admin accounts are created. You can now log in with the credentials below.
            </p>
          </div>
        ) : (
          <div className="border-4 border-yellow-600 rounded-lg p-8 mb-8" style={{ backgroundColor: "#FFF9C4" }}>
            <h2 className="text-3xl font-bold text-red-900 mb-4 text-center">
              🚨 LOGIN ISSUE? CLICK BELOW TO FORCE-SEED ADMINS!
            </h2>
            <div className="flex justify-center">
              <button
                onClick={handleForceSeed}
                disabled={seeding}
                className="px-8 py-4 bg-red-600 text-white text-xl font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors shadow-lg"
              >
                {seeding ? "⏳ SEEDING..." : "🔴 FORCE SEED ADMINS NOW"}
              </button>
            </div>
          </div>
        )}

        {/* Admin Login Credentials */}
        <div className="bg-white border-2 border-gray-300 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-6 text-center">👥 Pharmacy Admin Login Credentials</h2>

          {/* AIM Admin */}
          <div className="mb-6 p-6 rounded-lg" style={{ backgroundColor: "#E1F5FE", border: "2px solid #00AEEF" }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: "#00AEEF" }}></div>
              <h3 className="font-bold text-xl">AIM Medical Technologies</h3>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-600 font-semibold">Email:</p>
                <div className="flex items-center gap-2">
                  <code className="text-lg bg-white px-3 py-2 rounded border-2 border-blue-300 font-mono">
                    aim_admin@aimmedtech.com
                  </code>
                  <button
                    onClick={() => copyToClipboard("aim_admin@aimmedtech.com", setCopiedAim)}
                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    {copiedAim ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-semibold">Password:</p>
                <code className="text-lg bg-white px-3 py-2 rounded border-2 border-blue-300 font-mono inline-block">
                  AIM2025!
                </code>
              </div>
              <p className="text-sm text-gray-700 mt-2">
                <strong>Expected branding:</strong> Teal/Blue (#00AEEF)
              </p>
            </div>
          </div>

          {/* Greenwich Admin */}
          <div className="p-6 rounded-lg" style={{ backgroundColor: "#E8F5E9", border: "2px solid #228B22" }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: "#228B22" }}></div>
              <h3 className="font-bold text-xl">Greenwich Pharmacy</h3>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-600 font-semibold">Email:</p>
                <div className="flex items-center gap-2">
                  <code className="text-lg bg-white px-3 py-2 rounded border-2 border-green-300 font-mono">
                    grin_admin@grinethch.com
                  </code>
                  <button
                    onClick={() => copyToClipboard("grin_admin@grinethch.com", setCopiedGrin)}
                    className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                  >
                    {copiedGrin ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 font-semibold">Password:</p>
                <code className="text-lg bg-white px-3 py-2 rounded border-2 border-green-300 font-mono inline-block">
                  Grin2025!
                </code>
              </div>
              <p className="text-sm text-gray-700 mt-2">
                <strong>Expected branding:</strong> Forest Green (#228B22)
              </p>
            </div>
          </div>
        </div>

        {/* Pharmacies Section */}
        <div className="bg-white border-2 border-purple-300 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-center">🏥 Seeded Pharmacies</h2>
          <p className="text-gray-600 mb-6 text-center">Two pharmacies are ready in the platform</p>

          <div className="space-y-4">
            {/* AIM Medical Technologies */}
            <div className="p-6 rounded-lg" style={{ backgroundColor: "#E1F5FE", border: "3px solid #00AEEF" }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full" style={{ backgroundColor: "#00AEEF" }}></div>
                <h3 className="font-bold text-xl">AIM Medical Technologies</h3>
                <span className="text-sm text-gray-600">(slug: aim)</span>
              </div>
              <div className="text-sm text-gray-700">
                <p><strong>Tagline:</strong> Advanced Integrated Medicine</p>
                <p><strong>Color:</strong> Teal/Blue (#00AEEF)</p>
                <p><strong>Status:</strong> ✓ Active</p>
              </div>
            </div>

            {/* Greenwich Pharmacy */}
            <div className="p-6 rounded-lg" style={{ backgroundColor: "#E8F5E9", border: "3px solid #228B22" }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full" style={{ backgroundColor: "#228B22" }}></div>
                <h3 className="font-bold text-xl">Greenwich Pharmacy</h3>
                <span className="text-sm text-gray-600">(slug: grinethch)</span>
              </div>
              <div className="text-sm text-gray-700">
                <p><strong>Tagline:</strong> Your Neighborhood Health Partner</p>
                <p><strong>Color:</strong> Forest Green (#228B22)</p>
                <p><strong>Status:</strong> ✓ Active</p>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <a
              href="/admin/debug-pharmacies"
              className="inline-block px-6 py-3 bg-purple-600 text-white text-lg font-bold rounded-lg hover:bg-purple-700 transition-colors"
            >
              → Edit Pharmacies (Debug Page)
            </a>
          </div>
        </div>

        {/* Login Link */}
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-6 text-center">
          <h3 className="text-xl font-bold mb-4">🔗 Go to Login</h3>
          <a
            href={appUrl}
            className="inline-block px-8 py-3 bg-blue-600 text-white text-lg font-bold rounded-lg hover:bg-blue-700 transition-colors"
          >
            {appUrl}
          </a>
        </div>

        {/* Quick Test Instructions */}
        <div className="bg-white border-2 border-gray-300 rounded-lg p-6 mt-6">
          <h3 className="text-xl font-bold mb-4">✅ Quick Test</h3>
          <ol className="space-y-3 text-gray-700">
            <li className="flex items-start gap-2">
              <span className="font-bold text-blue-600">1.</span>
              <span>Click &quot;Go to Login&quot; above → Log in as <strong>aim_admin@aimmedtech.com</strong> → See <strong className="text-blue-600">teal branding</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-green-600">2.</span>
              <span>Log out → Log in as <strong>grin_admin@grinethch.com</strong> → See <strong className="text-green-600">green branding</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-purple-600">3.</span>
              <span>Verify: Each pharmacy admin sees their own pharmacy&apos;s branding! 🎉</span>
            </li>
          </ol>
        </div>

        {/* Debug Link */}
        <div className="mt-6 text-center">
          <a
            href="/admin/debug-pharmacies"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            → Advanced: View Debug Page (Database Status)
          </a>
        </div>
      </div>
    </div>
  );
}
