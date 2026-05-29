import { ReactNode } from "react";

export interface Addendum {
  id: string;
  encounterId: string;
  content: string;
  createdAt: string;
  createdBy: string;
}

export type EncounterWorkflowType =
  | "clinical"
  | "d2c"
  | "coaching"
  | "order_based"
  | "order_based_async"
  | "order_based_sync";

// Base props that all workflow components should accept
export interface BaseWorkflowProps {
  encounter: {
    id: string;
    date: string;
    status: string;
    businessType: string;
    title: string;
    providerName?: string;
    providerNotes?: string;
    finalizedAt?: string | null;
    finalizedBy?: string | null;
  };
  isFinalized: boolean;
  loading?: boolean;
  children?: ReactNode;
  context?: WorkflowContext;
  onFinalize?: () => Promise<void>;
  onApproveOrder?: () => Promise<void>;
  onRejectOrder?: () => Promise<void>;
  isLoadingOrderAction?: boolean;
}

// Extended props for Notes components
export interface NotesWorkflowProps extends BaseWorkflowProps {
  providerNotes: string;
  onProviderNotesChange: (notes: string) => void;
  finalizedDate: Date | null;
  onAddAddendum: () => void;
  isAddingAddendum: boolean;
  addendums: Addendum[];
  onSaveAddendum: (content: string) => void;
  onCancelAddendum: () => void;
}

// Extended props for Intake components
export interface IntakeWorkflowProps extends BaseWorkflowProps {
  onOpenIntake: () => void;
}

// Extended props for Vitals components
export interface VitalsWorkflowProps extends BaseWorkflowProps {
  vitalsEdit: {
    bp: string;
    hr: string;
    temp: string;
    resp: string;
    spo2: string;
    weight: string;
    height: string;
    bmi: string;
  };
  onVitalsChange: (field: string, value: string) => void;
}

// Extended props for workflow layouts
export interface WorkflowLayoutProps extends BaseWorkflowProps {
  children: ReactNode;
}

export interface WorkflowTabConfig {
  id: string;
  label: string;
  component: React.ComponentType<BaseWorkflowProps>;
  props?: Record<string, unknown>;
  visible?: boolean;
  order?: number;
}

export interface WorkflowPanelConfig {
  id: string;
  component: React.ComponentType<BaseWorkflowProps>;
  props?: Record<string, unknown>;
  visible?: boolean;
  order?: number;
}

export interface WorkflowConfig {
  type: EncounterWorkflowType;
  name: string;
  description: string;
  tabs: WorkflowTabConfig[];
  panels: WorkflowPanelConfig[];
  headerActions?: {
    component: React.ComponentType<BaseWorkflowProps>;
    props?: Record<string, unknown>;
  };
  customLayout?: {
    component: React.ComponentType<WorkflowLayoutProps>;
    props?: Record<string, unknown>;
  };
}

export interface WorkflowContext {
  workflowType: EncounterWorkflowType;
  config: WorkflowConfig;
  encounterId: string;
  patientId: string;
  userId: string;
}
