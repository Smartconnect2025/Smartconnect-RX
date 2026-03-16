/**
 * Route Configuration
 *
 * This file contains the route configurations for the application.
 * You can modify this file to add, update, or remove protected routes.
 */
import { ProtectedRouteConfig } from "./types";

/**
 * Redirect paths for different scenarios
 * Customize these to change where users are redirected
 */
export const redirectPaths = {
  home: "/",
  login: "/auth/login",
  dashboard: "/",
  adminDashboard: "/admin",
  providerDashboard: "/prescriptions",
  patientDashboard: "/",
  notFound: "/404",
  unauthorized: "/", // Redirect to home instead of non-existent 403 page
};

/**
 * Public admin routes (no authentication required)
 * These are checked first before protected routes
 */
export const publicAdminRoutes = [
  "/admin/quick-start-guide",
  "/admin/debug-pharmacies",
];

/**
 * Default protected routes configuration
 * Everything else is considered public by default
 */
export const protectedRoutes: ProtectedRouteConfig[] = [
  // Routes that only unauthenticated users should access
  {
    type: "auth",
    patterns: [
      { path: "/auth", exact: true },
      { path: "/auth/login", exact: true },
      { path: "/auth/register", exact: true },
      { path: "/auth/forgot-password", exact: true },
      { path: "/request-pharmacy-access", exact: true },
      { path: "/request-doctor-access", exact: true },
    ],
  },

  // Routes with custom access conditions
  {
    type: "special",
    patterns: [
      {
        path: "/auth/reset-password",
        exact: true,
        conditions: { hasToken: true },
      },
      {
        path: "/auth/verify",
        exact: true,
        conditions: { hasToken: true },
      },
    ],
  },

  // Routes that require authentication and "user" role (patients only)
  {
    type: "user",
    patterns: [
      { path: "/intake", exact: false }, // Patient intake process - only for patients
      { path: "/test", exact: false }, // Test pages
      { path: "/dashboard", exact: false },
      { path: "/profile", exact: false },
      { path: "/checkout", exact: false },
      { path: "/orders", exact: false },
      { path: "/catalog", exact: false }, // Product catalog/shop
      { path: "/storefront", exact: false }, // Shop/storefront
      { path: "/telehealth", exact: false },
      { path: "/appointments", exact: false }, // Appointment management
      { path: "/goals", exact: false }, // Patient goals
      { path: "/provider-search", exact: false }, // Provider search and booking
      { path: "/resources", exact: false }, // Resources
      { path: "/video-call/patient", exact: false }, // Patient video calls
      { path: "/patient", exact: false }, // Patient dashboard and related pages
      { path: "/vitals", exact: false }, // Vitals tracking
      { path: "/labs", exact: false }, // Lab results
      { path: "/journal-mood-tracking", exact: false }, // Mood tracking
      { path: "/symptom-tracker", exact: false }, // Symptom tracking
    ],
  },

  // Routes that require provider role
  {
    type: "provider",
    patterns: [
      { path: "/provider", exact: false },
      { path: "/prescriptions", exact: false },
      { path: "/video-call/provider", exact: false }, // Provider video calls
      { path: "/basic-emr", exact: false }, // EMR - provider only
      { path: "/appointment", exact: false }, // Appointment video calls - accessible by both providers and patients
    ],
  },

  // Routes that require admin role
  {
    type: "admin",
    patterns: [
      { path: "/admin", exact: false }, // Main admin dashboard and all sub-routes
      { path: "/admin/patients", exact: false }, // Patient management
      { path: "/admin/providers", exact: false }, // Provider management
      { path: "/admin/resources", exact: false }, // Resources management
      { path: "/admin/products", exact: false }, // Products and categories management
      { path: "/admin/prescriptions", exact: false }, // Pharmacy admin queue
      { path: "/admin/settings", exact: false }, // Admin settings
    ],
  },
];
