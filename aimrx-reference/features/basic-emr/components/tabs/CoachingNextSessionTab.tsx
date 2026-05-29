"use client";

import { BaseWorkflowProps } from "../../types/workflow.types";

interface CoachingNextSessionTabProps extends BaseWorkflowProps {
  // Future props for next session functionality
  nextSessionDate?: string;
  nextSessionNotes?: string;
  onScheduleNextSession?: (date: string, notes: string) => void;
  onRescheduleSession?: () => void;
}

export function CoachingNextSessionTab({
  encounter: _encounter,
  isFinalized: _isFinalized,
  nextSessionDate: _nextSessionDate,
  nextSessionNotes: _nextSessionNotes,
  onScheduleNextSession: _onScheduleNextSession,
  onRescheduleSession: _onRescheduleSession,
}: CoachingNextSessionTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          Next Session Planning
        </h2>
        {!_isFinalized && (
          <div className="text-sm text-gray-500">Plan upcoming session</div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-teal-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Next Session Placeholder
          </h3>
          <p className="text-gray-600 max-w-md mx-auto">
            This is where the next coaching session will be planned, scheduled,
            and prepared.
          </p>
        </div>
      </div>
    </div>
  );
}
