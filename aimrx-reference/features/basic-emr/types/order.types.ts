import { type EmrOrder as DrizzleOrder } from "@core/database/schema/emr_orders";

export type OrderType = "lab" | "imaging" | "medication" | "referral";

export interface Order
  extends Omit<
    DrizzleOrder,
    | "created_at"
    | "updated_at"
    | "details"
    | "ordered_at"
    | "order_type"
    | "ordered_by"
    | "patient_id"
    | "encounter_id"
  > {
  readonly id: string;
  patientId: string;
  encounterId: string;
  type: OrderType;
  title: string;
  details?: string | null;
  orderedBy: string;
  orderedAt: string;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

export interface LocalOrder {
  id: string;
  type: OrderType;
  title: string;
  details: string;
  isLocal: true;
}

export type OrderEdit = Partial<{
  type: string;
  title: string;
  details: string;
}>;
