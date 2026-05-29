import { createClient } from "@core/supabase/client";
import {
  getOrderTypeConfig,
  getBusinessTypeForOrder,
} from "../config/order-types";
import { encounterService } from "./encounterService";
import { appointmentOrderLinkingService } from "./appointmentOrderLinkingService";
import { coachingEncounterService } from "./coachingEncounterService";

interface FlowCreationData {
  orderId: string;
  patientId: string;
  orderType: string;
  userId: string;
  providerId?: string;
}

interface CoachingFlowCreationData {
  appointmentId?: string;
  patientId: string;
  userId: string;
  providerId?: string;
  sessionType?: "life_coaching" | "wellness_coaching" | "career_coaching";
  title?: string;
  date?: string;
}

interface FlowResult {
  success: boolean;
  encounterId?: string;
  appointmentId?: string;
  error?: string;
  flowType: "async" | "sync" | "coaching";
}

export class FlowFactory {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Create the appropriate flow based on order type
   */
  async createOrderFlow(data: FlowCreationData): Promise<FlowResult> {
    try {
      const orderConfig = getOrderTypeConfig(data.orderType);
      const businessType = getBusinessTypeForOrder(data.orderType);

      if (!orderConfig) {
        return {
          success: false,
          error: "Invalid order type",
          flowType: "async",
        };
      }

      // Determine flow type
      const flowType = orderConfig.requiresAppointment ? "sync" : "async";

      if (flowType === "async") {
        return await this.createAsyncFlow(data, businessType);
      } else {
        return await this.createSyncFlow(data, businessType);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        flowType: "async",
      };
    }
  }

  /**
   * Create async flow (no appointment required)
   */
  private async createAsyncFlow(
    data: FlowCreationData,
    businessType: string,
  ): Promise<FlowResult> {
    try {
      // Create encounter directly for async orders
      const encounterData = {
        patientId: data.patientId,
        title: `Order Review: ${data.orderId.slice(0, 8)}`,
        date: new Date().toISOString(),
        type: "consultation" as const,
        provider: "System",
        providerId: data.providerId,
        businessType: businessType as "order_based_async" | "order_based_sync",
        orderId: data.orderId,
      };

      const result = await encounterService.createEncounter(
        data.userId,
        encounterData,
      );

      if (result.success && result.data) {
        return {
          success: true,
          encounterId: result.data.id,
          flowType: "async",
        };
      } else {
        return {
          success: false,
          error: result.error || "Failed to create async encounter",
          flowType: "async",
        };
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create async flow",
        flowType: "async",
      };
    }
  }

  /**
   * Create sync flow (appointment required)
   */
  private async createSyncFlow(
    data: FlowCreationData,
    businessType: string,
  ): Promise<FlowResult> {
    try {
      // For sync orders, we create an encounter that requires an appointment
      // The appointment will be scheduled separately and linked later
      const encounterData = {
        patientId: data.patientId,
        title: `Order Review: ${data.orderId.slice(0, 8)} (Appointment Required)`,
        date: new Date().toISOString(),
        type: "consultation" as const,
        provider: "TBD",
        providerId: data.providerId,
        businessType: businessType as "order_based_async" | "order_based_sync",
        orderId: data.orderId,
      };

      const result = await encounterService.createEncounter(
        data.userId,
        encounterData,
      );

      if (result.success && result.data) {
        return {
          success: true,
          encounterId: result.data.id,
          flowType: "sync",
        };
      } else {
        return {
          success: false,
          error: result.error || "Failed to create sync encounter",
          flowType: "sync",
        };
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create sync flow",
        flowType: "sync",
      };
    }
  }

  /**
   * Link appointment to existing sync order encounter
   */
  async linkAppointmentToSyncOrder(
    appointmentId: string,
    orderId: string,
    userId: string,
  ): Promise<FlowResult> {
    try {
      // Get appointment data
      const { data: appointment, error: appointmentError } = await this.supabase
        .from("appointments")
        .select(
          `
          *,
          provider:providers(*)
        `,
        )
        .eq("id", appointmentId)
        .single();

      if (appointmentError || !appointment) {
        return {
          success: false,
          error: "Appointment not found",
          flowType: "sync",
        };
      }

      // Get order data
      const { data: order, error: orderError } = await this.supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (orderError || !order) {
        return {
          success: false,
          error: "Order not found",
          flowType: "sync",
        };
      }

      // Link appointment to order
      const linkResult =
        await appointmentOrderLinkingService.linkAppointmentToOrder(
          {
            id: appointment.id,
            reference: appointment.id,
            patientId: appointment.patient_id,
            providerId: appointment.provider_id,
            appointmentDate: appointment.datetime,
            title: appointment.reason,
            status: "scheduled",
          },
          {
            id: order.id,
            patientId: order.user_id,
            orderType: "sync",
            title: `Order #${order.id.slice(0, 8)}`,
            status: order.status,
          },
          userId,
        );

      return {
        success: linkResult.success,
        encounterId: linkResult.encounterId,
        appointmentId: appointment.id,
        error: linkResult.error,
        flowType: "sync",
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to link appointment",
        flowType: "sync",
      };
    }
  }

  /**
   * Create coaching flow (appointment-based or ad-hoc)
   */
  async createCoachingFlow(
    data: CoachingFlowCreationData,
  ): Promise<FlowResult> {
    try {
      if (data.appointmentId) {
        // Appointment-based coaching flow
        return await this.createAppointmentBasedCoachingFlow(data);
      } else {
        // Ad-hoc coaching flow
        return await this.createAdHocCoachingFlow(data);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        flowType: "coaching",
      };
    }
  }

  /**
   * Create appointment-based coaching flow
   */
  private async createAppointmentBasedCoachingFlow(
    data: CoachingFlowCreationData,
  ): Promise<FlowResult> {
    try {
      if (!data.appointmentId) {
        return {
          success: false,
          error:
            "Appointment ID is required for appointment-based coaching flow",
          flowType: "coaching",
        };
      }

      // Get appointment data
      const { data: appointment, error: appointmentError } = await this.supabase
        .from("appointments")
        .select(
          `
          *,
          provider:providers(*)
        `,
        )
        .eq("id", data.appointmentId)
        .single();

      if (appointmentError || !appointment) {
        return {
          success: false,
          error: "Appointment not found",
          flowType: "coaching",
        };
      }

      // Create coaching encounter from appointment
      const result =
        await coachingEncounterService.createEncounterFromAppointment(
          data.userId,
          {
            id: appointment.id,
            patientId: appointment.patient_id,
            providerId: appointment.provider_id,
            sessionDate: appointment.datetime,
            title: appointment.reason,
            status: "scheduled",
            sessionType: data.sessionType,
          },
        );

      return {
        success: result.success,
        encounterId: result.encounterId,
        appointmentId: appointment.id,
        error: result.error,
        flowType: "coaching",
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create appointment-based coaching flow",
        flowType: "coaching",
      };
    }
  }

  /**
   * Create ad-hoc coaching flow
   */
  private async createAdHocCoachingFlow(
    data: CoachingFlowCreationData,
  ): Promise<FlowResult> {
    try {
      // Create ad-hoc coaching encounter
      const result =
        await coachingEncounterService.createAdHocCoachingEncounter(
          data.userId,
          {
            patientId: data.patientId,
            title: data.title || "Coaching Session",
            date: data.date || new Date().toISOString(),
            type: "consultation",
            provider: "Provider", // This will be resolved by the service
            sessionType: data.sessionType,
          },
        );

      return {
        success: result.success,
        encounterId: result.encounterId,
        error: result.error,
        flowType: "coaching",
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create ad-hoc coaching flow",
        flowType: "coaching",
      };
    }
  }

  /**
   * Get flow status for an order
   */
  async getOrderFlowStatus(orderId: string): Promise<{
    flowType: "async" | "sync";
    hasEncounter: boolean;
    hasAppointment: boolean;
    encounterId?: string;
    appointmentId?: string;
    status: "pending" | "in_progress" | "completed";
  }> {
    try {
      // Check for encounter
      const encounter =
        await appointmentOrderLinkingService.getEncounterByOrderId(orderId);

      if (!encounter) {
        return {
          flowType: "async",
          hasEncounter: false,
          hasAppointment: false,
          status: "pending",
        };
      }

      const flowType =
        encounter.business_type === "order_based_sync" ? "sync" : "async";
      const hasAppointment = !!encounter.appointment_id;

      let status: "pending" | "in_progress" | "completed" = "pending";
      if (encounter.status === "completed") {
        status = "completed";
      } else if (encounter.status === "in_progress" || hasAppointment) {
        status = "in_progress";
      }

      return {
        flowType,
        hasEncounter: true,
        hasAppointment,
        encounterId: encounter.id,
        appointmentId: encounter.appointment_id || undefined,
        status,
      };
    } catch (error) {
      console.error("Error getting order flow status:", error);
      return {
        flowType: "async",
        hasEncounter: false,
        hasAppointment: false,
        status: "pending",
      };
    }
  }

  /**
   * Get orders that need flow creation
   */
  async getOrdersNeedingFlowCreation(
    providerId?: string,
  ): Promise<FlowCreationData[]> {
    try {
      const { data: orders, error } = await this.supabase
        .from("orders")
        .select(
          `
          id,
          user_id,
          status,
          created_at,
          order_line_items (
            name,
            product_id
          )
        `,
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const ordersNeedingFlow: FlowCreationData[] = [];

      for (const order of orders || []) {
        // Check if encounter already exists
        const existingEncounter =
          await appointmentOrderLinkingService.getEncounterByOrderId(order.id);
        if (existingEncounter) {
          continue; // Skip orders that already have encounters
        }

        // Determine order type from line items
        const orderType = this.determineOrderTypeFromLineItems(
          order.order_line_items || [],
        );

        ordersNeedingFlow.push({
          orderId: order.id,
          patientId: order.user_id,
          orderType,
          userId: order.user_id,
          providerId,
        });
      }

      return ordersNeedingFlow;
    } catch (error) {
      console.error("Error getting orders needing flow creation:", error);
      return [];
    }
  }

  /**
   * Get coaching flow status for an appointment or encounter
   */
  async getCoachingFlowStatus(
    appointmentId?: string,
    encounterId?: string,
  ): Promise<{
    flowType: "coaching";
    hasEncounter: boolean;
    hasAppointment: boolean;
    encounterId?: string;
    appointmentId?: string;
    status: "pending" | "in_progress" | "completed";
  }> {
    try {
      let encounter = null;

      if (encounterId) {
        // Get encounter by ID
        const { data, error } = await this.supabase
          .from("encounters")
          .select("*")
          .eq("id", encounterId)
          .eq("business_type", "coaching")
          .single();

        if (!error && data) {
          encounter = data;
        }
      } else if (appointmentId) {
        // Get encounter by appointment ID
        const { data, error } = await this.supabase
          .from("encounters")
          .select("*")
          .eq("appointment_id", appointmentId)
          .eq("business_type", "coaching")
          .single();

        if (!error && data) {
          encounter = data;
        }
      }

      if (!encounter) {
        return {
          flowType: "coaching",
          hasEncounter: false,
          hasAppointment: !!appointmentId,
          appointmentId,
          status: "pending",
        };
      }

      const hasAppointment = !!encounter.appointment_id;

      let status: "pending" | "in_progress" | "completed" = "pending";
      if (encounter.status === "completed") {
        status = "completed";
      } else if (encounter.status === "in_progress" || hasAppointment) {
        status = "in_progress";
      }

      return {
        flowType: "coaching",
        hasEncounter: true,
        hasAppointment,
        encounterId: encounter.id,
        appointmentId: encounter.appointment_id || appointmentId,
        status,
      };
    } catch (error) {
      console.error("Error getting coaching flow status:", error);
      return {
        flowType: "coaching",
        hasEncounter: false,
        hasAppointment: !!appointmentId,
        appointmentId,
        status: "pending",
      };
    }
  }

  /**
   * Get coaching appointments that need flow creation
   */
  async getCoachingAppointmentsNeedingFlowCreation(
    providerId?: string,
  ): Promise<CoachingFlowCreationData[]> {
    try {
      const query = this.supabase
        .from("appointments")
        .select(
          `
          id,
          patient_id,
          provider_id,
          datetime,
          reason,
          type,
          status
        `,
        )
        .eq("status", "scheduled")
        .eq("type", "coaching")
        .order("datetime", { ascending: false });

      if (providerId) {
        query.eq("provider_id", providerId);
      }

      const { data: appointments, error } = await query;

      if (error) {
        throw error;
      }

      const appointmentsNeedingFlow: CoachingFlowCreationData[] = [];

      for (const appointment of appointments || []) {
        // Check if encounter already exists
        const existingEncounter =
          await coachingEncounterService.getEncounterByAppointmentId(
            appointment.id,
          );
        if (existingEncounter) {
          continue; // Skip appointments that already have encounters
        }

        appointmentsNeedingFlow.push({
          appointmentId: appointment.id,
          patientId: appointment.patient_id,
          userId: appointment.patient_id, // Assuming patient is the user
          providerId: appointment.provider_id,
          sessionType: this.determineCoachingSessionType(appointment.reason),
          title: appointment.reason,
          date: appointment.datetime,
        });
      }

      return appointmentsNeedingFlow;
    } catch (error) {
      console.error(
        "Error getting coaching appointments needing flow creation:",
        error,
      );
      return [];
    }
  }

  /**
   * Determine coaching session type from appointment reason
   */
  private determineCoachingSessionType(
    reason?: string,
  ): "life_coaching" | "wellness_coaching" | "career_coaching" {
    if (!reason) return "life_coaching";

    const reasonLower = reason.toLowerCase();

    if (
      reasonLower.includes("career") ||
      reasonLower.includes("job") ||
      reasonLower.includes("professional")
    ) {
      return "career_coaching";
    }
    if (
      reasonLower.includes("wellness") ||
      reasonLower.includes("health") ||
      reasonLower.includes("fitness")
    ) {
      return "wellness_coaching";
    }

    return "life_coaching"; // Default
  }

  /**
   * Future: Goal-based coaching flow (placeholder)
   * This will be implemented when goal tracking system is ready
   */
  async createGoalBasedCoachingFlow(
    _goalId: string,
    _patientId: string,
    _userId: string,
  ): Promise<FlowResult> {
    // TODO: Implement goal-based coaching flow
    // This will create coaching encounters based on goal milestones
    // and trigger sessions when goals need attention

    return {
      success: false,
      error: "Goal-based coaching flows not yet implemented",
      flowType: "coaching",
    };
  }

  /**
   * Determine order type from line items
   */
  private determineOrderTypeFromLineItems(
    lineItems: { name?: string }[],
  ): string {
    for (const item of lineItems) {
      const itemName = item.name?.toLowerCase() || "";

      if (itemName.includes("trt") || itemName.includes("testosterone")) {
        return "TRT";
      }
      if (itemName.includes("weight loss")) {
        return "weight_loss";
      }
      if (itemName.includes("controlled")) {
        return "controlled_medication";
      }
      if (itemName.includes("lab")) {
        return "lab_test";
      }
    }

    return "medication"; // Default to async medication
  }
}

export const flowFactory = new FlowFactory();
