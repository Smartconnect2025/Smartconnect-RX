"use client";

import { BaseWorkflowProps } from "../../types/workflow.types";

interface CoachingResourcesTabProps extends BaseWorkflowProps {
  // Future props for resources functionality
  resources?: Array<{
    id: string;
    title: string;
    type: "document" | "video" | "exercise" | "link";
    url?: string;
    description: string;
  }>;
  onAddResource?: () => void;
  onShareResource?: (resourceId: string) => void;
}

export function CoachingResourcesTab({
  encounter: _encounter,
  isFinalized: _isFinalized,
  resources: _resources,
  onAddResource: _onAddResource,
  onShareResource: _onShareResource,
}: CoachingResourcesTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          Coaching Resources
        </h2>
        {!_isFinalized && (
          <div className="text-sm text-gray-500">
            Share materials with client
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Resources Placeholder
          </h3>
          <p className="text-gray-600 max-w-md mx-auto">
            This is where educational materials, exercises, and tools will be
            shared with clients.
          </p>
        </div>
      </div>
    </div>
  );
}
