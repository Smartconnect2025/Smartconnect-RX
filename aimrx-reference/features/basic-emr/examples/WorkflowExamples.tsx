"use client";

import { EncounterView } from "../components/EncounterView";
import { BaseWorkflowProps } from "../types/workflow.types";

// Example 1: Auto-detect workflow from encounter type
export function AutoDetectWorkflowExample() {
  return <EncounterView patientId="patient-123" encounterId="encounter-456" />;
}

// Example 2: Force specific workflow type
export function D2CWorkflowExample() {
  return (
    <EncounterView
      patientId="patient-123"
      encounterId="encounter-456"
      workflowType="d2c"
    />
  );
}

// Example 3: Coaching workflow
export function CoachingWorkflowExample() {
  return (
    <EncounterView
      patientId="patient-123"
      encounterId="encounter-456"
      workflowType="coaching"
    />
  );
}

// Example 4: Order-based workflow
export function OrderBasedWorkflowExample() {
  return (
    <EncounterView
      patientId="patient-123"
      encounterId="encounter-456"
      workflowType="order_based"
    />
  );
}

// Example 5: Custom components with workflow
export function CustomComponentsExample() {
  const CustomNotesTab = ({
    encounter,
    isFinalized,
    loading: _loading,
    children: _children,
    ..._props
  }: BaseWorkflowProps) => (
    <div className="p-4 bg-blue-50 rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Custom Notes Tab</h3>
      <textarea
        value={encounter.providerNotes || ""}
        onChange={(e) => {
          // Handle notes change
        }}
        className="w-full h-32 p-2 border rounded"
        placeholder="Enter custom notes..."
        disabled={isFinalized}
      />
    </div>
  );

  return (
    <EncounterView
      patientId="patient-123"
      encounterId="encounter-456"
      workflowType="clinical"
      NotesComponent={CustomNotesTab}
    />
  );
}
