"use client";

import { BaseWorkflowProps, WorkflowConfig } from "../types/workflow.types";
import { D2CWorkflow } from "../components/workflows/D2CWorkflow";
import { CoachingWorkflow } from "../components/workflows/CoachingWorkflow";
import {
  NotesTab,
  OrdersTab,
  AppointmentDetailsTab,
  CoachingSessionNotesTab,
  CoachingGoalsTab,
  CoachingResourcesTab,
  CoachingNextSessionTab,
} from "../components/tabs";

// Wrapper components for complex tabs to match BaseWorkflowProps interface
const OrdersTabWrapper = (props: BaseWorkflowProps) => (
  <OrdersTab
    orders={[]}
    isFinalized={props.isFinalized}
    getOrderFieldValue={() => ""}
    onUpdateOrder={async () => {}}
    onRemoveOrder={async () => {}}
    onPlaceOrder={async () => {}}
    onPrintOrder={() => {}}
    onAddOrder={() => {}}
  />
);

const NotesTabWrapper = (props: BaseWorkflowProps) => (
  <NotesTab
    providerNotes={props.encounter.providerNotes || ""}
    onProviderNotesChange={() => {}}
    isFinalized={props.isFinalized}
    finalizedDate={
      props.encounter.finalizedAt ? new Date(props.encounter.finalizedAt) : null
    }
    onAddAddendum={() => {}}
    isAddingAddendum={false}
    addendums={[]}
    onSaveAddendum={() => {}}
    onCancelAddendum={() => {}}
  >
    {props.children}
  </NotesTab>
);

const AppointmentDetailsTabWrapper = (props: BaseWorkflowProps) => (
  <AppointmentDetailsTab
    encounter={{
      id: props.encounter.id,
      date: props.encounter.date,
      status: props.encounter.status,
      businessType: props.encounter.businessType,
      title: props.encounter.title,
      providerName: props.encounter.providerName,
      providerNotes: props.encounter.providerNotes,
      finalizedAt: props.encounter.finalizedAt,
      finalizedBy: props.encounter.finalizedBy || undefined,
      appointment_id: undefined,
    }}
    appointment={undefined}
    onJoinCall={() => {}}
    onReschedule={() => {}}
    onCancel={() => {}}
  />
);

// Coaching tab wrappers
const CoachingSessionNotesTabWrapper = (props: BaseWorkflowProps) => (
  <CoachingSessionNotesTab
    encounter={props.encounter}
    isFinalized={props.isFinalized}
  />
);

const CoachingGoalsTabWrapper = (props: BaseWorkflowProps) => (
  <CoachingGoalsTab
    encounter={props.encounter}
    isFinalized={props.isFinalized}
  />
);

const CoachingResourcesTabWrapper = (props: BaseWorkflowProps) => (
  <CoachingResourcesTab
    encounter={props.encounter}
    isFinalized={props.isFinalized}
  />
);

const CoachingNextSessionTabWrapper = (props: BaseWorkflowProps) => (
  <CoachingNextSessionTab
    encounter={props.encounter}
    isFinalized={props.isFinalized}
  />
);

// Labs & Results component (currently unused, but kept for future use)
// const LabsResultsTab = ({ encounter: _encounter, isFinalized: _isFinalized }: BaseWorkflowProps) => (
//   <div className="space-y-6">
//     <h2 className="text-xl font-semibold text-gray-900">Labs & Results</h2>
//     <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
//       <p className="text-orange-800">
//         Lab results, imaging reports, and diagnostic data
//       </p>
//     </div>
//   </div>
// );

// D2C Recommendations component
const D2CRecommendationsTab = ({
  encounter: _encounter,
  isFinalized: _isFinalized,
}: BaseWorkflowProps) => (
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
);

// D2C Checkout component
const D2CCheckoutTab = ({
  encounter: _encounter,
  isFinalized: _isFinalized,
}: BaseWorkflowProps) => (
  <div className="space-y-6">
    <h2 className="text-xl font-semibold text-gray-900">Checkout & Payment</h2>
    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
      <p className="text-green-800">
        Streamlined checkout process for D2C purchases
      </p>
    </div>
  </div>
);

// D2C Follow-up component
const D2CFollowupTab = ({
  encounter: _encounter,
  isFinalized: _isFinalized,
}: BaseWorkflowProps) => (
  <div className="space-y-6">
    <h2 className="text-xl font-semibold text-gray-900">Follow-up Care</h2>
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
      <p className="text-purple-800">
        Automated follow-up scheduling and care reminders
      </p>
    </div>
  </div>
);

export const workflowConfigs: Record<string, WorkflowConfig> = {
  clinical: {
    type: "clinical",
    name: "Clinical Workflow",
    description: "Standard clinical encounter with notes, orders, and billing",
    tabs: [],
    panels: [],
    // No customLayout - will use original UI
  },

  d2c: {
    type: "d2c",
    name: "Direct-to-Consumer Workflow",
    description: "D2C assessment and product recommendation flow",
    tabs: [
      {
        id: "assessment",
        label: "Assessment",
        component: D2CRecommendationsTab,
        order: 1,
        visible: true,
      },
      {
        id: "recommendations",
        label: "Recommendations",
        component: D2CRecommendationsTab,
        order: 2,
        visible: true,
      },
      {
        id: "checkout",
        label: "Checkout",
        component: D2CCheckoutTab,
        order: 3,
        visible: true,
      },
      {
        id: "followup",
        label: "Follow-up",
        component: D2CFollowupTab,
        order: 4,
        visible: true,
      },
    ],
    panels: [],
    customLayout: {
      component: D2CWorkflow,
    },
  },

  coaching: {
    type: "coaching",
    name: "Coaching Workflow",
    description: "Life coaching and wellness session management",
    tabs: [
      {
        id: "session",
        label: "Session Notes",
        component: CoachingSessionNotesTabWrapper,
        order: 1,
        visible: true,
      },
      {
        id: "goals",
        label: "Goals & Progress",
        component: CoachingGoalsTabWrapper,
        order: 2,
        visible: true,
      },
      {
        id: "resources",
        label: "Resources",
        component: CoachingResourcesTabWrapper,
        order: 3,
        visible: true,
      },
      {
        id: "next-session",
        label: "Next Session",
        component: CoachingNextSessionTabWrapper,
        order: 4,
        visible: true,
      },
    ],
    panels: [],
    customLayout: {
      component: CoachingWorkflow,
    },
  },

  order_based: {
    type: "order_based",
    name: "Order-Based Workflow",
    description: "Order review and approval workflow",
    tabs: [],
    panels: [],
    // No customLayout - will use original UI
  },

  order_based_async: {
    type: "order_based_async",
    name: "Async Order Review",
    description: "Asynchronous order review workflow",
    tabs: [
      {
        id: "orders",
        label: "Orders",
        component: OrdersTabWrapper,
      },
      {
        id: "notes",
        label: "Notes",
        component: NotesTabWrapper,
      },
    ],
    panels: [],
  },

  order_based_sync: {
    type: "order_based_sync",
    name: "Sync Order Review",
    description: "Synchronous order review with appointment",
    tabs: [
      {
        id: "appointment",
        label: "Appointment",
        component: AppointmentDetailsTabWrapper,
      },
      {
        id: "orders",
        label: "Orders",
        component: OrdersTabWrapper,
      },
      {
        id: "notes",
        label: "Notes",
        component: NotesTabWrapper,
      },
    ],
    panels: [],
  },
};

export function getWorkflowConfig(workflowType: string): WorkflowConfig {
  return workflowConfigs[workflowType] || workflowConfigs.clinical;
}

export function getWorkflowConfigByEncounterType(
  encounterType?: string,
): WorkflowConfig {
  // Map encounter types to workflow types
  const typeMapping: Record<string, string> = {
    clinical: "clinical",
    d2c: "d2c",
    coaching: "coaching",
    order_based: "order_based",
    order_based_async: "order_based_async",
    order_based_sync: "order_based_sync",
  };

  const workflowType = typeMapping[encounterType || ""] || "clinical";
  return getWorkflowConfig(workflowType);
}
