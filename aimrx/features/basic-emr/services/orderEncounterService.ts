import { createClient } from "@core/supabase/client";
import { encounterService } from "./encounterService";
import { EncounterBusinessType, EncounterType } from "../types";

export interface OrderData {
  id: string;
  patientId: string;
  title: string;
  details?: string;
  orderType: string;
  createdAt: string;
}

export interface CreateEncounterData {
  patientId: string;
  title: string;
  date: string;
  type: EncounterType;
  provider: string;
  providerId?: string;
  businessType: EncounterBusinessType;
  orderId?: string;
}

class OrderEncounterService {
  public supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Create encounter from order (when order needs provider review)
   */
  async createEncounterFromOrder(
    userId: string,
    orderData: OrderData,
  ): Promise<{ success: boolean; encounterId?: string; error?: string }> {
    try {
      // Check if encounter already exists for this order
      const existingEncounter = await this.getEncounterByOrderId(orderData.id);
      if (existingEncounter) {
        return {
          success: true,
          encounterId: existingEncounter.id,
          error: "Encounter already exists for this order",
        };
      }

      // Get provider details from the current user
      const { data: providerData } = await this.supabase
        .from("providers")
        .select("id, first_name, last_name")
        .eq("user_id", userId)
        .single();

      if (!providerData) {
        return {
          success: false,
          error: "Provider information not found",
        };
      }

      // Create encounter data
      const encounterData: CreateEncounterData = {
        patientId: orderData.patientId,
        title: `Order Review: ${orderData.title}`,
        date: new Date().toISOString(),
        type: "consultation",
        provider: `${providerData.first_name} ${providerData.last_name}`,
        providerId: providerData.id,
        businessType: "order_based" as EncounterBusinessType,
        orderId: orderData.id,
      };

      const result = await encounterService.createEncounter(
        userId,
        encounterData,
      );

      if (result.success && result.data) {
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
  async getEncounterByOrderId(_orderId: string) {
    try {
      const { data, error } = await this.supabase
        .from("encounters")
        .select("*")
        .eq("order_id", _orderId)
        .eq("business_type", "order_based")
        .single();

      if (error) return null;
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Get all order-based encounters for a patient
   */
  async getOrderEncounters(patientId: string, _userId: string) {
    try {
      const { data, error } = await this.supabase
        .from("encounters")
        .select(
          `
          *,
          emr_orders!inner(*)
        `,
        )
        .eq("patient_id", patientId)
        .eq("business_type", "order_based")
        .order("encounter_date", { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error fetching order encounters:", error);
      return [];
    }
  }

  /**
   * Update order status when encounter is finalized
   */
  async updateOrderStatus(orderId: string, status: string) {
    try {
      const { error } = await this.supabase
        .from("emr_orders")
        .update({ status })
        .eq("id", orderId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get order details for encounter
   */
  async getOrderDetails(orderId: string) {
    try {
      const { data, error } = await this.supabase
        .from("emr_orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error fetching order details:", error);
      return null;
    }
  }
}

export const orderEncounterService = new OrderEncounterService();
