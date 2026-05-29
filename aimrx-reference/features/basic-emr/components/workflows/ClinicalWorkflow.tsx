"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkflowContext } from "../../types/workflow.types";

interface ClinicalWorkflowProps {
  context?: WorkflowContext;
  children: React.ReactNode;
}

export function ClinicalWorkflow({ children }: ClinicalWorkflowProps) {
  return (
    <Tabs defaultValue="notes" className="w-full h-full">
      <TabsList className="w-full rounded-none mt-6 mb-0 justify-start">
        <TabsTrigger
          value="notes"
          className="data-[state=active]:bg-white bg-gray-100"
        >
          Notes
        </TabsTrigger>
        <TabsTrigger
          value="orders"
          className="data-[state=active]:bg-white bg-gray-100"
        >
          Orders
        </TabsTrigger>
        <TabsTrigger
          value="billing"
          className="data-[state=active]:bg-white bg-gray-100"
        >
          Coding & Billing
        </TabsTrigger>
        <TabsTrigger
          value="labs"
          className="data-[state=active]:bg-white bg-gray-100"
        >
          Labs & Results
        </TabsTrigger>
      </TabsList>

      <TabsContent value="notes" className="flex-1 p-8 pt-6">
        {children}
      </TabsContent>

      <TabsContent value="orders" className="p-8">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Clinical Orders
          </h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800">
              Prescriptions, referrals, imaging, and lab orders
            </p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="billing" className="p-8">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Coding & Billing
          </h2>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">
              CPT/ICD-10 coding and billing information
            </p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="labs" className="p-8">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Labs & Results
          </h2>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-orange-800">
              Lab results, imaging reports, and diagnostic data
            </p>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
