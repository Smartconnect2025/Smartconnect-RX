import { useMemo } from "react";
import {
  WorkflowContext,
  EncounterWorkflowType,
} from "../types/workflow.types";
import { getWorkflowConfigByEncounterType } from "../config/workflow-configs";

interface UseWorkflowProps {
  workflowType?: EncounterWorkflowType;
  encounterType?: string;
  encounterId: string;
  patientId: string;
  userId: string;
}

export function useWorkflow({
  workflowType,
  encounterType,
  encounterId,
  patientId,
  userId,
}: UseWorkflowProps) {
  const workflowConfig = useMemo(() => {
    return getWorkflowConfigByEncounterType(workflowType || encounterType);
  }, [workflowType, encounterType]);

  const workflowContext = useMemo(
    (): WorkflowContext => ({
      workflowType: workflowConfig.type,
      config: workflowConfig,
      encounterId,
      patientId,
      userId,
    }),
    [workflowConfig, encounterId, patientId, userId],
  );

  return {
    workflowConfig,
    workflowContext,
    workflowType: workflowConfig.type,
  };
}
