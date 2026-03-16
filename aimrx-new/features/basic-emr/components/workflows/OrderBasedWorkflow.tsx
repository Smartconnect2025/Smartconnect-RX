"use client";

import { WorkflowContext } from "../../types/workflow.types";

interface OrderBasedWorkflowProps {
  context?: WorkflowContext;
  children: React.ReactNode;
}

export function OrderBasedWorkflow({ children }: OrderBasedWorkflowProps) {
  return (
    <div className="p-8">
      <div className="flex h-full space-x-6">
        <div className="flex-1">
          {/* Order Details Section */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Order Details
            </h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-gray-900">
                  Order Review
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Review Required
                </span>
              </div>
              <p className="text-gray-600 mb-2">
                Review and approve/reject the submitted order
              </p>
            </div>
          </div>

          {/* Billing Details Section */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Billing Information
            </h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">
                    Payment Status
                  </h4>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Paid</span>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Amount</h4>
                  <span className="text-lg font-semibold text-gray-900">
                    $150.00
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Provider Notes Section */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Provider Notes
            </h2>
            {children}
          </div>
        </div>

        <aside className="w-80 space-y-6">{children}</aside>
      </div>
    </div>
  );
}
