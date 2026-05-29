"use client";

import { BaseWorkflowProps } from "../../types/workflow.types";

interface CoachingSessionNotesTabProps extends BaseWorkflowProps {
  // Future props for session notes functionality
  sessionNotes?: string;
  onSessionNotesChange?: (notes: string) => void;
}

export function CoachingSessionNotesTab({
  encounter: _encounter,
  isFinalized: _isFinalized,
  sessionNotes: _sessionNotes,
  onSessionNotesChange: _onSessionNotesChange,
}: CoachingSessionNotesTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Session Notes</h2>
        {!_isFinalized && (
          <div className="text-sm text-gray-500">Session in progress</div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Session Notes Placeholder
          </h3>
          <p className="text-gray-600 max-w-md mx-auto">
            This is where coaching session notes, observations, and insights
            will be captured and managed.
          </p>
        </div>
      </div>
    </div>
  );
}
