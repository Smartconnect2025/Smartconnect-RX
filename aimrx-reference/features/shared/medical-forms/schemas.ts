import * as z from "zod";

// Shared options
export const severityOptions = ["Mild", "Moderate", "Severe"] as const;
export const statusOptions = ["Active", "Resolved", "Managed"] as const;
export const frequencyOptions = [
  "Once daily",
  "Twice daily", 
  "Three times daily",
  "Four times daily",
  "As needed"
] as const;

// Common conditions for autocomplete
export const commonConditions = [
  "Type 2 Diabetes",
  "Hypertension", 
  "Asthma",
  "Anxiety",
  "Depression",
  "High Cholesterol",
  "Arthritis",
  "GERD",
  "Migraine", 
  "Sleep Apnea"
] as const;

// Common medications for autocomplete
export const commonMedications = [
  "Metformin",
  "Lisinopril",
  "Albuterol", 
  "Omeprazole",
  "Sertraline",
  "Ibuprofen",
  "Levothyroxine",
  "Amlodipine",
  "Gabapentin",
  "Atorvastatin"
] as const;

// Shared schemas for medical data
export const conditionSchema = z.object({
  name: z.string().min(1, "Condition name is required"),
  onsetDate: z.date({
    required_error: "Onset date is required",
  }),
  currentStatus: z.enum(statusOptions, {
    required_error: "Current status is required", 
  }),
  severity: z.enum(severityOptions, {
    required_error: "Severity is required",
  }),
  notes: z.string().optional(),
});

export const medicationSchema = z.object({
  name: z.string().min(1, "Medication name is required"),
  dosage: z.string().min(1, "Dosage is required"), 
  frequency: z.enum(frequencyOptions, {
    required_error: "Frequency is required",
  }),
  startDate: z.date({
    required_error: "Start date is required",
  }),
  currentStatus: z.enum(statusOptions, {
    required_error: "Current status is required",
  }),
});

export const allergySchema = z.object({
  allergen: z.string().min(1, "Allergen is required"),
  reaction: z.string().min(1, "Reaction description is required"),
  severity: z.enum(severityOptions, {
    required_error: "Severity is required", 
  }),
});

// Base medical history schema
export const baseMedicalHistorySchema = z.object({
  conditions: z.array(conditionSchema).optional().default([]),
  medications: z.array(medicationSchema).optional().default([]),
  allergies: z.array(allergySchema).optional().default([]),
});

// Export types
export type Condition = z.infer<typeof conditionSchema>;
export type Medication = z.infer<typeof medicationSchema>;
export type Allergy = z.infer<typeof allergySchema>;
export type BaseMedicalHistory = z.infer<typeof baseMedicalHistorySchema>; 