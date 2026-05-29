import { createClient } from "@core/supabase/client";
import { encounterService } from "./encounterService";

interface AppointmentData {
  id: string;
  reference: string;
  patientId: string;
  providerId: string;
  appointmentDate: string;
  title: string;
  status: string;
}

interface OrderData {
  id: string;
  patientId: string;
  orderType: string;
  title: string;
  status: string;
}

interface LinkResult {
  success: boolean;
  encounterId?: string;
  error?: string;
}

class AppointmentOrderLinkingService {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Link an appointment to a sync order by creating an encounter
   */
  async linkAppointmentToOrder(
    appointmentData: AppointmentData,
    orderData: OrderData,
    userId: string,
  ): Promise<LinkResult> {
    try {
      // Check if encounter already exists for this order
      const existingOrderEncounter = await this.getEncounterByOrderId(
        orderData.id,
      );
      if (existingOrderEncounter) {
        return {
          success: true,
          encounterId: existingOrderEncounter.id,
          error: "Encounter already exists for this order",
        };
      }

      // Check if encounter already exists for this appointment
      const existingAppointmentEncounter =
        await this.getEncounterByAppointmentId(appointmentData.id);
      if (existingAppointmentEncounter) {
        // Update the existing appointment encounter to link it to the order
        const { error: updateError } = await this.supabase
          .from("encounters")
          .update({
            order_id: orderData.id,
            business_type: "order_based_sync", // Use order_based_sync for sync orders
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingAppointmentEncounter.id);

        if (updateError) {
          throw updateError;
        }

        return {
          success: true,
          encounterId: existingAppointmentEncounter.id,
        };
      }

      // Create encounter data
      const encounterData = {
        patientId: orderData.patientId,
        title: `Appointment with Order Review: ${orderData.title}`,
        date: appointmentData.appointmentDate,
        type: "consultation" as const,
        provider: "Provider", // Will be updated with actual provider name
        providerId: appointmentData.providerId,
        businessType: "order_based_sync" as const, // Use order_based_sync for sync orders
        appointmentId: appointmentData.id,
        orderId: orderData.id, // Link the order to the appointment encounter
      };

      const result = await encounterService.createEncounter(
        userId,
        encounterData,
      );

      if (result.success && result.data) {
        // Update the appointment with encounter reference
        await this.updateAppointmentWithEncounter(
          appointmentData.id,
          result.data.id,
        );

        return {
          success: true,
          encounterId: result.data.id,
        };
      } else {
        return {
          success: false,
          error: result.error || "Failed to create encounter",
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get encounter by order ID
   */
  async getEncounterByOrderId(orderId: string) {
    try {
      const { data, error } = await this.supabase
        .from("encounters")
        .select("*")
        .eq("order_id", orderId)
        .limit(1);

      if (error) {
        throw error;
      }

      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error("Error fetching encounter by order ID:", error);
      return null;
    }
  }

  /**
   * Get encounter by appointment ID
   */
  async getEncounterByAppointmentId(appointmentId: string) {
    try {
      const { data, error } = await this.supabase
        .from("encounters")
        .select("*")
        .eq("appointment_id", appointmentId)
        .limit(1);

      if (error) {
        throw error;
      }

      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error("Error fetching encounter by appointment ID:", error);
      return null;
    }
  }

  /**
   * Update appointment with encounter reference
   */
  private async updateAppointmentWithEncounter(
    appointmentId: string,
    encounterId: string | null,
  ): Promise<void> {
    try {
      const updateData: { encounter_id?: string | null; updated_at: string } = {
        updated_at: new Date().toISOString(),
      };

      if (encounterId !== null) {
        updateData.encounter_id = encounterId;
      } else {
        updateData.encounter_id = null;
      }

      const { error } = await this.supabase
        .from("appointments")
        .update(updateData)
        .eq("id", appointmentId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Error updating appointment with encounter:", error);
      throw error;
    }
  }

  /**
   * Unlink appointment from order (remove encounter)
   */
  async unlinkAppointmentFromOrder(
    appointmentId: string,
    orderId: string,
  ): Promise<LinkResult> {
    try {
      // Find the encounter
      const encounter = await this.getEncounterByOrderId(orderId);
      if (!encounter) {
        return {
          success: false,
          error: "No encounter found for this order",
        };
      }

      // Delete the encounter
      const { error } = await this.supabase
        .from("encounters")
        .delete()
        .eq("id", encounter.id);

      if (error) {
        throw error;
      }

      // Remove encounter reference from appointment
      await this.updateAppointmentWithEncounter(appointmentId, null);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get all sync orders that need appointments
   */
  async getSyncOrdersNeedingAppointments(
    providerId?: string,
  ): Promise<OrderData[]> {
    try {
      const query = this.supabase
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

      if (providerId) {
        // Filter by provider's licensed state if needed
        // This would require additional logic based on your provider setup
      }

      const { data: orders, error } = await query;

      if (error) {
        throw error;
      }

      // Filter orders that require appointments (sync orders)
      const syncOrders: OrderData[] = [];

      for (const order of orders || []) {
        // Check if this order has an encounter already
        const existingEncounter = await this.getEncounterByOrderId(order.id);
        if (existingEncounter) {
          continue; // Skip orders that already have encounters
        }

        // Determine if this is a sync order based on line items
        const hasSyncProducts = order.order_line_items?.some(
          (item: { name?: string }) => {
            const itemName = item.name?.toLowerCase() || "";
            return (
              itemName.includes("trt") ||
              itemName.includes("testosterone") ||
              itemName.includes("controlled") ||
              itemName.includes("weight loss")
            );
          },
        );

        if (hasSyncProducts) {
          syncOrders.push({
            id: order.id,
            patientId: order.user_id,
            orderType: "sync",
            title: `Order #${order.id.slice(0, 8)}`,
            status: order.status,
          });
        }
      }

      return syncOrders;
    } catch (error) {
      console.error("Error fetching sync orders:", error);
      return [];
    }
  }
}

export const appointmentOrderLinkingService =
  new AppointmentOrderLinkingService();
