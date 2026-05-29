"use client";

import { VitalsSection } from "../VitalsSection";
import { VitalsWorkflowProps } from "../../types/workflow.types";

export function VitalsPanel({
  encounter: _encounter,
  isFinalized,
  vitalsEdit,
  onVitalsChange,
}: VitalsWorkflowProps) {
  return (
    <VitalsSection
      vitalsEdit={vitalsEdit}
      isFinalized={isFinalized}
      onVitalsChange={onVitalsChange}
    />
  );
}
