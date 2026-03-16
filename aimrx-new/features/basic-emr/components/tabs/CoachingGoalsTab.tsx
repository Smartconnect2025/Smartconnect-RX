"use client";

import { BaseWorkflowProps } from "../../types/workflow.types";

interface CoachingGoalsTabProps extends BaseWorkflowProps {
  // Future props for goals functionality
  goals?: Array<{
    id: string;
    title: string;
    description: string;
    status: "active" | "completed" | "paused";
    progress: number;
  }>;
  onAddGoal?: () => void;
  onUpdateGoal?: (goalId: string, updates: Record<string, unknown>) => void;
}

export function CoachingGoalsTab({
  encounter: _encounter,
  isFinalized: _isFinalized,
  goals: _goals,
  onAddGoal: _onAddGoal,
  onUpdateGoal: _onUpdateGoal,
}: CoachingGoalsTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          Goals & Progress
        </h2>
        {!_isFinalized && (
          <div className="text-sm text-gray-500">Track client progress</div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Goals & Progress Placeholder
          </h3>
          <p className="text-gray-600 max-w-md mx-auto">
            This is where client goals, milestones, and progress tracking will
            be managed and visualized.
          </p>
        </div>
      </div>
    </div>
  );
}
