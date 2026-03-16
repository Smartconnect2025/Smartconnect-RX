"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkflowLayoutProps } from "../../types/workflow.types";

export function D2CWorkflow({
  encounter: _encounter,
  isFinalized: _isFinalized,
  loading: _loading,
  children,
}: WorkflowLayoutProps) {
  return (
    <Tabs defaultValue="assessment" className="w-full h-full">
      <TabsList className="w-full rounded-none mt-6 mb-0 justify-start">
        <TabsTrigger
          value="assessment"
          className="data-[state=active]:bg-white bg-gray-100"
        >
          Assessment
        </TabsTrigger>
        <TabsTrigger
          value="recommendations"
          className="data-[state=active]:bg-white bg-gray-100"
        >
          Recommendations
        </TabsTrigger>
        <TabsTrigger
          value="checkout"
          className="data-[state=active]:bg-white bg-gray-100"
        >
          Checkout
        </TabsTrigger>
        <TabsTrigger
          value="followup"
          className="data-[state=active]:bg-white bg-gray-100"
        >
          Follow-up
        </TabsTrigger>
      </TabsList>

      <TabsContent value="assessment" className="flex-1 p-8 pt-6">
        {children}
      </TabsContent>

      <TabsContent value="recommendations" className="p-8">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Product Recommendations
          </h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800">
              AI-powered product recommendations based on assessment results
            </p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="checkout" className="p-8">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Checkout & Payment
          </h2>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">
              Streamlined checkout process for D2C purchases
            </p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="followup" className="p-8">
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Follow-up Care
          </h2>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-purple-800">
              Automated follow-up scheduling and care reminders
            </p>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
