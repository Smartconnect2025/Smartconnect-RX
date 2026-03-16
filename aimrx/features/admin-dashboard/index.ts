/**
 * Admin Dashboard Feature
 * Exports all components, types, and utilities for the admin dashboard feature
 */

// Export main components
export { AdminDashboard } from "./AdminDashboard";

// Export reusable components
export { MetricCard } from "./components/MetricCard";
export { PatientsManagement } from "./components/PatientsManagement";
export { ProvidersManagement } from "./components/ProvidersManagement";
export { TagsManagement } from "./components/TagsManagement";
export { TiersManagement } from "./components/TiersManagement";
export { GroupsManagement } from "./components/GroupsManagement";
export { PlatformManagersManagement } from "./components/PlatformManagersManagement";

// Export hooks
export { useAdminDashboard } from "./hooks/useAdminDashboard";

// Export services
export {
  getDashboardMetrics,
  getMonthlyComparison,
} from "./services/adminService";

// Export utils
export * from "./utils";

// Export types
export * from "./types";
