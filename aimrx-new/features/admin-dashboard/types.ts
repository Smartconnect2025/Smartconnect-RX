/**
 * Admin Dashboard Types
 * Type definitions for the admin dashboard feature
 */

export interface AdminDashboardProps {
  className?: string;
}

export interface AdminStats {
  totalPatients: number;
  totalProviders: number;
  totalResources: number;
}

export interface DashboardMetrics {
  totalPatients: number;
  totalProviders: number;
  totalAppointments: number;
  totalOrders: number;
  totalResources: number;
  patientsGrowth: number;
  providersGrowth: number;
  appointmentsGrowth: number;
  ordersGrowth: number;
  resourcesGrowth: number;
}

export interface MonthlyComparison {
  current: number;
  previous: number;
  growth: number;
}

// Tag types for admin dashboard
export interface Tag {
  id: string;
  name: string;
  slug: string;
  usage_count: number;
  pharmacy_id?: string | null;
  pharmacy_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTagData {
  name: string;
  slug?: string;
  usage_count?: number;
  pharmacy_id?: string;
}

export interface UpdateTagData {
  name?: string;
  slug?: string;
  usage_count?: number;
}

// Platform Manager types
export interface PlatformManager {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePlatformManagerData {
  name: string;
}

export interface UpdatePlatformManagerData {
  name?: string;
}

// Group types
export interface Group {
  id: string;
  name: string;
  platform_manager_id: string | null;
  platform_manager_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGroupData {
  name: string;
  platformManagerId?: string;
}

export interface UpdateGroupData {
  name?: string;
  platformManagerId?: string;
}

// Provider types
export interface Provider {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone_number?: string | null;
  specialty?: string;
  avatar_url?: string;
  npi_number?: string | null;
  licensed_states?: string[];
  service_types?: string[];
  insurance_plans?: string[];
  medical_licenses?: Array<{
    licenseNumber: string;
    state: string;
  }> | null;
  created_at: string;
  status: "active" | "inactive";
  role: string;
  is_verified: boolean;
  group_id?: string | null;
  group_name?: string | null;
  platform_manager_name?: string | null;
  tier_level?: string;
  tier_code?: string | null;
  is_active?: boolean;
  user_id?: string;
  is_demo?: boolean;
  pharmacy_names?: string[];
}

// Patient types
export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  date_of_birth: string;
  gender?: string;
  city?: string;
  state?: string;
  avatar_url?: string;
  created_at: string;
  status: "active" | "inactive";
  role: string;
  pharmacy_id?: string | null;
  pharmacy_name?: string | null;
  // Intake data
  height?: string;
  weight?: string;
  blood_type?: string;
  allergies?: string[];
  medications?: string[];
  medical_conditions?: string[];
}
