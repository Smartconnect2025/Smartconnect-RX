/**
 * Type definitions for patient dashboard
 */

export interface PatientAddress {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  zipCode?: string;
  country?: string;
}

export interface PatientIntakeData {
  height?: string;
  weight?: string;
  blood_type?: string;
  allergies?: string[];
  medications?: string[];
  medical_conditions?: string[];
  gender?: string;
}

export interface PatientProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone?: string;
  email?: string;
  physical_address?: PatientAddress;
  billing_address?: PatientAddress;
  data?: PatientIntakeData;
  provider_id?: string;
  status?: string;
  is_active: boolean;
  created_at: string;
}

export interface ProviderInfo {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  specialty?: string;
  specialties?: { name: string }[];
  professional_bio?: string;
  avatar_url?: string;
}

export interface PatientPrescription {
  id: string;
  queue_id?: string;
  medication: string;
  dosage?: string;
  quantity: number;
  refills: number;
  status: string;
  submitted_at: string;
  tracking_number?: string;
  patient_price?: string;
  pharmacy_name?: string;
  pharmacy_color?: string;
}
