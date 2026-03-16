import { sql } from "drizzle-orm";
import {
  pgTable,
  pgPolicy,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { prescriptions } from "./prescriptions";
import { patients } from "./patients";
import { providers } from "./providers";
import { pharmacies } from "./pharmacies";

/**
 * Payment Transactions table
 * Tracks all payment transactions including Authorize.Net receipt data and progress
 */
export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // What is being paid for
    prescriptionId: uuid("prescription_id").references(() => prescriptions.id, {
      onDelete: "set null",
    }),

    // Payment breakdown (in cents)
    totalAmountCents: integer("total_amount_cents").notNull(),
    consultationFeeCents: integer("consultation_fee_cents")
      .notNull()
      .default(0),
    medicationCostCents: integer("medication_cost_cents").notNull().default(0),
    shippingFeeCents: integer("shipping_fee_cents").notNull().default(0),

    // Patient information
    patientId: uuid("patient_id").references(() => patients.id, {
      onDelete: "set null",
    }),
    patientEmail: text("patient_email"),
    patientPhone: text("patient_phone"),
    patientName: text("patient_name"),

    // Provider information
    providerId: uuid("provider_id").references(() => providers.id, {
      onDelete: "set null",
    }),
    providerName: text("provider_name"),

    // Pharmacy information
    pharmacyId: uuid("pharmacy_id").references(() => pharmacies.id, {
      onDelete: "set null",
    }),
    pharmacyName: text("pharmacy_name"),

    // Authorize.Net reference ID (20 chars max for Authorize.Net compatibility)
    // This is used as refId and invoiceNumber when communicating with Authorize.Net
    authnetRefId: text("authnet_ref_id").unique(),

    // Authorize.Net transaction details
    authnetTransactionId: text("authnet_transaction_id"),
    authnetAuthorizationCode: text("authnet_authorization_code"),
    authnetResponseCode: text("authnet_response_code"),
    authnetResponseReason: text("authnet_response_reason"),

    // Payment link (magic link)
    paymentToken: text("payment_token").notNull().unique(),
    paymentLinkUrl: text("payment_link_url"),
    paymentLinkExpiresAt: timestamp("payment_link_expires_at", {
      withTimezone: true,
    }),
    paymentLinkUsedAt: timestamp("payment_link_used_at", {
      withTimezone: true,
    }),

    // Card information (PCI compliant - last 4 only)
    cardLastFour: text("card_last_four"),
    cardType: text("card_type"),

    // Payment status
    paymentStatus: text("payment_status").notNull().default("pending"),
    // 'pending' | 'completed' | 'declined' | 'failed' | 'cancelled' | 'refunded' | 'expired'

    // Order progress (for progress bar)
    orderProgress: text("order_progress").notNull().default("payment_pending"),
    // 'payment_pending' | 'payment_received' | 'provider_approved' | 'pharmacy_processing' | 'shipped' | 'ready_for_pickup' | 'completed'

    // Delivery method
    deliveryMethod: text("delivery_method").notNull().default("pickup"),
    // 'pickup' | 'delivery' | 'shipping'

    // Tracking information (for delivery/shipping only)
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),

    // Email/SMS notification tracking
    paymentLinkEmailSentAt: timestamp("payment_link_email_sent_at", {
      withTimezone: true,
    }),
    paymentConfirmationEmailSentAt: timestamp(
      "payment_confirmation_email_sent_at",
      { withTimezone: true },
    ),

    // Description
    description: text("description"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    // Webhook data (for debugging)
    webhookReceivedAt: timestamp("webhook_received_at", { withTimezone: true }),
    webhookPayload: jsonb("webhook_payload"),

    // Payment timing (from Authorize.Net)
    paidAt: timestamp("paid_at", { withTimezone: true }),

    // Refund information
    refundAmountCents: integer("refund_amount_cents"),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
  },
  (table) => [
    // SELECT: Patient, provider (own or assigned), pharmacy admin, or admin
    pgPolicy("payment_transactions_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR public.is_own_patient_record(${table.patientId})
      OR public.is_own_provider_record(${table.providerId})
      OR public.provider_has_patient_access(${table.patientId})
      OR public.is_pharmacy_admin(${table.pharmacyId})
    `,
    }),
    // INSERT: Provider with patient access, or admin
    pgPolicy("payment_transactions_insert_policy", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR (public.is_own_provider_record(${table.providerId})
          AND public.provider_has_patient_access(${table.patientId}))
    `,
    }),
    // UPDATE: Provider with patient access, pharmacy admin, or admin
    pgPolicy("payment_transactions_update_policy", {
      for: "update",
      to: authenticatedRole,
      using: sql`
      public.is_admin(auth.uid())
      OR (public.is_own_provider_record(${table.providerId})
          AND public.provider_has_patient_access(${table.patientId}))
      OR public.is_pharmacy_admin(${table.pharmacyId})
    `,
      withCheck: sql`
      public.is_admin(auth.uid())
      OR (public.is_own_provider_record(${table.providerId})
          AND public.provider_has_patient_access(${table.patientId}))
      OR public.is_pharmacy_admin(${table.pharmacyId})
    `,
    }),
    // DELETE: Admin only
    pgPolicy("payment_transactions_delete_policy", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin(auth.uid())`,
    }),
  ],
);

// Type exports
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type InsertPaymentTransaction = typeof paymentTransactions.$inferInsert;
export type UpdatePaymentTransaction = Partial<InsertPaymentTransaction>;

// Payment status enum
export const PaymentStatus = {
  PENDING: "pending",
  COMPLETED: "completed",
  DECLINED: "declined",
  FAILED: "failed",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
  EXPIRED: "expired",
} as const;

export type PaymentStatusType =
  (typeof PaymentStatus)[keyof typeof PaymentStatus];

// Order progress enum
export const OrderProgress = {
  PAYMENT_PENDING: "payment_pending",
  PAYMENT_RECEIVED: "payment_received",
  PROVIDER_APPROVED: "provider_approved",
  PHARMACY_PROCESSING: "pharmacy_processing",
  SHIPPED: "shipped",
  READY_FOR_PICKUP: "ready_for_pickup",
  COMPLETED: "completed",
} as const;

export type OrderProgressType =
  (typeof OrderProgress)[keyof typeof OrderProgress];

// Delivery method enum
export const DeliveryMethod = {
  PICKUP: "pickup",
  DELIVERY: "delivery",
  SHIPPING: "shipping",
} as const;

export type DeliveryMethodType =
  (typeof DeliveryMethod)[keyof typeof DeliveryMethod];
