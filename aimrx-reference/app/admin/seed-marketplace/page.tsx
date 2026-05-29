"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function SeedMarketplacePage() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    error?: string;
    message?: string;
    count?: number;
    details?: string;
  } | null>(null);

  const handleSeed = async () => {
    setIsSeeding(true);
    setResult(null);

    try {
      const response = await fetch("/api/admin/seed-real-medications", {
        method: "POST",
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({
        error: "Failed to seed medications",
        details: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl py-16 px-4">
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
        <h1 className="text-3xl font-bold mb-4">💰 Seed Amazon-Style Marketplace</h1>
        <p className="text-gray-600 mb-6">
          This will DELETE all old test medications and seed 40 real medications (20 AIM peptides/GLP-1 + 20 Greenwich traditional Rx) with
          categories.
        </p>

        <div className="space-y-4">
          <Button onClick={handleSeed} disabled={isSeeding} size="lg" className="w-full">
            {isSeeding ? "Seeding..." : "🚀 Seed 40 Real Medications"}
          </Button>

          {result && (
            <div className={`p-4 rounded-md ${result.error ? "bg-red-50 text-red-900" : "bg-green-50 text-green-900"}`}>
              <pre className="text-sm overflow-auto">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>

        {result && result.success && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="font-semibold text-blue-900 mb-2">✅ Next Steps:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
              <li>
                Login as doctor (james@demo.com / Doctor2025!) at{" "}
                <a href="/login" className="underline font-semibold">
                  /login
                </a>
              </li>
              <li>
                Go to <a href="/prescriptions/new/step1" className="underline font-semibold">New Prescription</a>
              </li>
              <li>See the beautiful Amazon-style marketplace with categories!</li>
              <li>Click &quot;Weight Loss (GLP-1)&quot; to see AIM high-profit peptides</li>
              <li>Click &quot;Traditional Rx&quot; to see Greenwich medications</li>
              <li>Sort by &quot;Highest Profit&quot; to see Retatrutide (+$360 profit) at the top</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
