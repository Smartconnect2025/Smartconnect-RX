import { Suspense } from "react";
import { ProviderFinancialDashboard } from "@/features/provider-financial-dashboard";

export default function ProviderDashboardPage() {
  return (
    <Suspense>
      <ProviderFinancialDashboard />
    </Suspense>
  );
}
