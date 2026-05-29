import { EncounterBusinessTypeEnum } from "../types";

/**
 * Configuration for different order types and their encounter requirements
 */
export interface OrderTypeConfig {
  type: string;
  name: string;
  description: string;
  requiresAppointment: boolean;
  businessType: EncounterBusinessTypeEnum;
  category:
    | "medication"
    | "supplement"
    | "controlled_substance"
    | "lab"
    | "imaging"
    | "other";
}

/**
 * Order type configurations that determine encounter behavior
 */
export const orderTypeConfigs: OrderTypeConfig[] = [
  // Async orders (no appointment required)
  {
    type: "medication",
    name: "Medication",
    description: "Standard medication order",
    requiresAppointment: false,
    businessType: EncounterBusinessTypeEnum.OrderBasedAsync,
    category: "medication",
  },
  {
    type: "supplement",
    name: "Supplement",
    description: "Vitamin or supplement order",
    requiresAppointment: false,
    businessType: EncounterBusinessTypeEnum.OrderBasedAsync,
    category: "supplement",
  },
  {
    type: "lab_test",
    name: "Lab Test",
    description: "Laboratory test order",
    requiresAppointment: false,
    businessType: EncounterBusinessTypeEnum.OrderBasedAsync,
    category: "lab",
  },

  // Sync orders (appointment required)
  {
    type: "TRT",
    name: "Testosterone Replacement Therapy",
    description: "TRT requires video consultation",
    requiresAppointment: true,
    businessType: EncounterBusinessTypeEnum.OrderBasedSync,
    category: "controlled_substance",
  },
  {
    type: "controlled_medication",
    name: "Controlled Medication",
    description: "Controlled substance requiring consultation",
    requiresAppointment: true,
    businessType: EncounterBusinessTypeEnum.OrderBasedSync,
    category: "controlled_substance",
  },
  {
    type: "weight_loss",
    name: "Weight Loss Program",
    description: "Weight loss medication requiring consultation",
    requiresAppointment: true,
    businessType: EncounterBusinessTypeEnum.OrderBasedSync,
    category: "controlled_substance",
  },
  {
    type: "mental_health",
    name: "Mental Health Medication",
    description: "Mental health medication requiring consultation",
    requiresAppointment: true,
    businessType: EncounterBusinessTypeEnum.OrderBasedSync,
    category: "controlled_substance",
  },
];

/**
 * Get order type configuration by type
 */
export function getOrderTypeConfig(
  orderType: string,
): OrderTypeConfig | undefined {
  return orderTypeConfigs.find((config) => config.type === orderType);
}

/**
 * Get all order types that require appointments
 */
export function getSyncOrderTypes(): string[] {
  return orderTypeConfigs
    .filter((config) => config.requiresAppointment)
    .map((config) => config.type);
}

/**
 * Get all order types that don't require appointments
 */
export function getAsyncOrderTypes(): string[] {
  return orderTypeConfigs
    .filter((config) => !config.requiresAppointment)
    .map((config) => config.type);
}

/**
 * Check if an order type requires an appointment
 */
export function orderRequiresAppointment(orderType: string): boolean {
  const config = getOrderTypeConfig(orderType);
  return config?.requiresAppointment || false;
}

/**
 * Get business type for an order type
 */
export function getBusinessTypeForOrder(
  orderType: string,
): EncounterBusinessTypeEnum {
  const config = getOrderTypeConfig(orderType);
  return config?.businessType || EncounterBusinessTypeEnum.OrderBasedAsync;
}
