import { createClient } from "@core/supabase/client";

import { Order, OrderType } from "../types/order.types";

export interface EmrServiceResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateOrderData {
  patientId: string;
  encounterId: string;
  type: OrderType;
  title: string;
  orderedBy: string;
  details?: string;
}

type DbOrderRow = {
  id: string;
  patient_id: string;
  encounter_id: string;
  order_type: string;
  title: string;
  details?: string;
  status: string;
  ordered_at: string;
  ordered_by: string;
  created_at: Date;
  updated_at: Date;
};

class OrderService {
  private supabase;
  constructor() {
    this.supabase = createClient();
  }

  async getOrders(
    encounterId: string,
    userId: string,
  ): Promise<EmrServiceResponse<Order[]>> {
    try {
      const encounterCheck = await this.verifyEncounterOwnership(
        encounterId,
        userId,
      );
      if (!encounterCheck)
        throw new Error("Encounter not found or access denied");

      const { data, error } = await this.supabase
        .from("emr_orders")
        .select("*")
        .eq("encounter_id", encounterId)
        .order("ordered_at", { ascending: false });

      if (error) throw error;

      const orders: Order[] = data.map(this.mapDbOrderToType);

      return {
        success: true,
        data: orders,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch orders",
      };
    }
  }

  async createOrder(
    userId: string,
    orderData: Partial<Order>,
  ): Promise<EmrServiceResponse<Order>> {
    try {
      const encounterCheck = await this.verifyEncounterOwnership(
        orderData.encounterId!,
        userId,
      );
      if (!encounterCheck)
        throw new Error("Encounter not found or access denied");

      const dbOrder = {
        patient_id: orderData.patientId,
        encounter_id: orderData.encounterId,
        order_type: orderData.type,
        title: orderData.title,
        details: orderData.details,
        ordered_by: orderData.orderedBy,
      };

      const { data, error } = await this.supabase
        .from("emr_orders")
        .insert([dbOrder])
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: this.mapDbOrderToType(data),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create order",
      };
    }
  }

  async updateOrder(
    orderId: string,
    userId: string,
    updates: Partial<Order>,
  ): Promise<EmrServiceResponse<Order>> {
    try {
      // First check if order exists and user has access
      const { data: orderData, error: fetchError } = await this.supabase
        .from("emr_orders")
        .select("encounter_id")
        .eq("id", orderId)
        .single();

      if (fetchError || !orderData) throw new Error("Order not found");

      const encounterCheck = await this.verifyEncounterOwnership(
        orderData.encounter_id,
        userId,
      );
      if (!encounterCheck) throw new Error("Access denied");

      const dbUpdates: Record<string, unknown> = {};
      if (updates.type !== undefined) dbUpdates.order_type = updates.type;
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.details !== undefined) dbUpdates.details = updates.details;

      const { data, error } = await this.supabase
        .from("emr_orders")
        .update(dbUpdates)
        .eq("id", orderId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: this.mapDbOrderToType(data),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update order",
      };
    }
  }

  private mapDbOrderToType(dbOrder: DbOrderRow): Order {
    return {
      id: dbOrder.id,
      patientId: dbOrder.patient_id,
      encounterId: dbOrder.encounter_id,
      type: dbOrder.order_type as OrderType,
      title: dbOrder.title,
      details: dbOrder.details,
      orderedAt: dbOrder.ordered_at,
      orderedBy: dbOrder.ordered_by,
      createdAt: dbOrder.created_at,
      updatedAt: dbOrder.updated_at,
    };
  }

  async verifyEncounterOwnership(
    encounterId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from("encounters")
        .select("patient_id")
        .eq("id", encounterId)
        .single();
      if (error || !data) return false;
      return await this.verifyPatientOwnership(data.patient_id, userId);
    } catch {
      return false;
    }
  }

  async verifyPatientOwnership(
    patientId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      // Check if user is a provider
      const isProvider = await this.checkIfUserIsProvider(userId);

      if (isProvider) {
        // Providers can access any active patient
        const { data, error } = await this.supabase
          .from("patients")
          .select("id")
          .eq("id", patientId)
          .eq("is_active", true)
          .single();
        return !error && !!data;
      } else {
        // Non-providers can only access their own patient record
        const { data, error } = await this.supabase
          .from("patients")
          .select("id")
          .eq("id", patientId)
          .eq("user_id", userId)
          .eq("is_active", true)
          .single();
        return !error && !!data;
      }
    } catch {
      return false;
    }
  }

  async checkIfUserIsProvider(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from("providers")
        .select("id")
        .eq("user_id", userId)
        .single();
      return !error && !!data;
    } catch {
      return false;
    }
  }
}

export const orderService = new OrderService();
