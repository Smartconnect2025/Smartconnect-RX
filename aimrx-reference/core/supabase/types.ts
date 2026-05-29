/**
 * Supabase Types
 * 
 * Contains type definitions for the Supabase module
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Type for the Supabase client
 */
export type TypedSupabaseClient = SupabaseClient;

/**
 * Authentication response type
 */
export interface AuthResponse {
  success: boolean;
  error?: string;
  data?: unknown;
}

/**
 * Database operation response type
 */
export interface DbOperationResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
} 