import { createAdminClient } from "@core/database/client";

interface CreateServerNotificationParams {
  userId: string;
  type: string;
  title: string;
  body: string;
  critical?: boolean;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, unknown>;
  actions?: Array<{
    label: string;
    action_type: string;
    action_data?: Record<string, unknown>;
    display_order?: number;
  }>;
}

export async function createServerNotification(
  params: CreateServerNotificationParams,
) {
  const supabase = createAdminClient();

  const { data: notification, error } = await supabase
    .from("notifications")
    .insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      critical: params.critical || false,
      related_entity_type: params.relatedEntityType,
      related_entity_id: params.relatedEntityId,
      metadata: params.metadata,
    })
    .select()
    .single();

  if (error) {
    console.error("[ServerNotification] Failed to create notification:", error);
    return null;
  }

  if (params.actions && params.actions.length > 0) {
    const { error: actionsError } = await supabase
      .from("notification_actions")
      .insert(
        params.actions.map((action, index) => ({
          notification_id: notification.id,
          label: action.label,
          action_type: action.action_type,
          action_data: action.action_data,
          display_order: action.display_order ?? index,
        })),
      );

    if (actionsError) {
      console.error("[ServerNotification] Failed to create actions:", actionsError);
    }
  }

  return notification;
}

export async function notifyPrescriptionStatusChange(
  userId: string,
  prescriptionRef: string,
  patientName: string,
  newStatus: string,
  prescriptionId?: string,
) {
  const statusMessages: Record<
    string,
    { title: string; body: string; type: string; critical: boolean }
  > = {
    submitted: {
      title: "Order Submitted to Pharmacy",
      body: `Prescription ${prescriptionRef} for ${patientName} has been sent to the pharmacy for processing.`,
      type: "order",
      critical: false,
    },
    payment_received: {
      title: "Payment Received",
      body: `Payment confirmed for prescription ${prescriptionRef} (${patientName}). Order will be sent to pharmacy.`,
      type: "order",
      critical: false,
    },
    pending_payment: {
      title: "Payment Required",
      body: `Prescription ${prescriptionRef} for ${patientName} is awaiting payment before it can be processed.`,
      type: "order",
      critical: true,
    },
    processing: {
      title: "Pharmacy Processing Order",
      body: `Prescription ${prescriptionRef} for ${patientName} is being prepared by the pharmacy.`,
      type: "order",
      critical: false,
    },
    approved: {
      title: "Prescription Approved",
      body: `Prescription ${prescriptionRef} for ${patientName} has been approved by the pharmacy.`,
      type: "order",
      critical: false,
    },
    shipped: {
      title: "Order Shipped",
      body: `Prescription ${prescriptionRef} for ${patientName} has been shipped.`,
      type: "order",
      critical: false,
    },
    delivered: {
      title: "Order Delivered",
      body: `Prescription ${prescriptionRef} for ${patientName} has been delivered.`,
      type: "order",
      critical: false,
    },
    rejected: {
      title: "Prescription Rejected",
      body: `Prescription ${prescriptionRef} for ${patientName} has been rejected by the pharmacy. Please review.`,
      type: "order",
      critical: true,
    },
    cancelled: {
      title: "Order Cancelled",
      body: `Prescription ${prescriptionRef} for ${patientName} has been cancelled.`,
      type: "order",
      critical: true,
    },
    packed: {
      title: "Order Packed",
      body: `Prescription ${prescriptionRef} for ${patientName} has been packed and is ready for shipping.`,
      type: "order",
      critical: false,
    },
    picked_up: {
      title: "Order Picked Up / Shipped",
      body: `Prescription ${prescriptionRef} for ${patientName} has been picked up for delivery.`,
      type: "order",
      critical: false,
    },
    billing: {
      title: "Order in Billing",
      body: `Prescription ${prescriptionRef} for ${patientName} is currently being billed.`,
      type: "order",
      critical: false,
    },
  };

  if (!statusMessages[newStatus]) {
    return createServerNotification({
      userId,
      type: "order",
      title: "Order Status Updated",
      body: `Prescription ${prescriptionRef} for ${patientName} status changed to: ${newStatus.replace(/_/g, " ")}.`,
      critical: false,
      relatedEntityType: "prescription",
      relatedEntityId: prescriptionId,
      metadata: { prescriptionRef, patientName, status: newStatus },
      actions: prescriptionId
        ? [{ label: "View Order", action_type: "navigate", action_data: { url: `/prescriptions?highlight=${prescriptionId}` }, display_order: 0 }]
        : [],
    });
  }

  const msg = statusMessages[newStatus];

  const actions: CreateServerNotificationParams["actions"] = [];
  if (prescriptionId) {
    actions.push({
      label: "View Order",
      action_type: "navigate",
      action_data: { url: `/prescriptions?highlight=${prescriptionId}` },
      display_order: 0,
    });
  }

  return createServerNotification({
    userId,
    type: msg.type,
    title: msg.title,
    body: msg.body,
    critical: msg.critical,
    relatedEntityType: "prescription",
    relatedEntityId: prescriptionId,
    metadata: {
      prescriptionRef,
      patientName,
      status: newStatus,
    },
    actions,
  });
}
