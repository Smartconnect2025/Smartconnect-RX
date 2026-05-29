/**
 * Database Module Exports
 *
 * This file exports all components from the database core module,
 * making imports cleaner throughout the application.
 */

// Export database client for administrative operations
export { createAdminClient, createSeedClient } from "./client";

// Export all schema definitions
export * from "./schema";
