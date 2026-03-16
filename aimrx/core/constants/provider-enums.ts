/**
 * Provider-related enum constants
 * These serve as the source of truth for all provider profile dropdowns and validations
 */

// Gender options (matches database enum)
export const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
] as const;

// Practice type options (matches database enum)
export const PRACTICE_TYPE_OPTIONS = [
  { value: "solo", label: "Solo Practice" },
  { value: "group", label: "Group Practice" },
  { value: "hospital", label: "Hospital-based" },
  { value: "clinic", label: "Clinic" },
  { value: "telehealth", label: "Telehealth Only" },
] as const;

// Experience level options (matches database enum)
export const EXPERIENCE_LEVEL_OPTIONS = [
  { value: "entry", label: "Entry Level (0-2 years)" },
  { value: "mid", label: "Mid Level (3-7 years)" },
  { value: "senior", label: "Senior Level (8-15 years)" },
  { value: "expert", label: "Expert Level (15+ years)" },
] as const;

// US States (for medical licenses and addresses)
export const US_STATES = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
  { value: "DC", label: "District of Columbia" },
] as const;

// Medical specialties
export const MEDICAL_SPECIALTIES = [
  { value: "allergy_immunology", label: "Allergy & Immunology" },
  { value: "anesthesiology", label: "Anesthesiology" },
  { value: "cardiology", label: "Cardiology" },
  { value: "dermatology", label: "Dermatology" },
  { value: "emergency_medicine", label: "Emergency Medicine" },
  { value: "endocrinology", label: "Endocrinology" },
  { value: "family_medicine", label: "Family Medicine" },
  { value: "gastroenterology", label: "Gastroenterology" },
  { value: "general_surgery", label: "General Surgery" },
  { value: "geriatrics", label: "Geriatrics" },
  { value: "hematology", label: "Hematology" },
  { value: "infectious_disease", label: "Infectious Disease" },
  { value: "internal_medicine", label: "Internal Medicine" },
  { value: "nephrology", label: "Nephrology" },
  { value: "neurology", label: "Neurology" },
  { value: "neurosurgery", label: "Neurosurgery" },
  { value: "obstetrics_gynecology", label: "Obstetrics & Gynecology" },
  { value: "oncology", label: "Oncology" },
  { value: "ophthalmology", label: "Ophthalmology" },
  { value: "orthopedics", label: "Orthopedics" },
  { value: "otolaryngology", label: "Otolaryngology (ENT)" },
  { value: "pathology", label: "Pathology" },
  { value: "pediatrics", label: "Pediatrics" },
  { value: "physical_medicine", label: "Physical Medicine & Rehabilitation" },
  { value: "plastic_surgery", label: "Plastic Surgery" },
  { value: "psychiatry", label: "Psychiatry" },
  { value: "pulmonology", label: "Pulmonology" },
  { value: "radiology", label: "Radiology" },
  { value: "rheumatology", label: "Rheumatology" },
  { value: "urology", label: "Urology" },
  { value: "vascular_surgery", label: "Vascular Surgery" },
] as const;

// Medical subspecialties (organized by specialty)
export const MEDICAL_SUBSPECIALTIES = {
  cardiology: [
    { value: "interventional_cardiology", label: "Interventional Cardiology" },
    { value: "electrophysiology", label: "Electrophysiology" },
    { value: "heart_failure", label: "Heart Failure" },
    { value: "preventive_cardiology", label: "Preventive Cardiology" },
  ],
  pediatrics: [
    { value: "pediatric_cardiology", label: "Pediatric Cardiology" },
    { value: "pediatric_critical_care", label: "Pediatric Critical Care" },
    { value: "pediatric_endocrinology", label: "Pediatric Endocrinology" },
    {
      value: "pediatric_gastroenterology",
      label: "Pediatric Gastroenterology",
    },
    {
      value: "pediatric_hematology_oncology",
      label: "Pediatric Hematology-Oncology",
    },
    { value: "neonatology", label: "Neonatology" },
  ],
  // Add more specialty-specific subspecialties as needed
} as const;

// Common languages spoken by healthcare providers
export const COMMON_LANGUAGES = [
  { value: "english", label: "English" },
  { value: "spanish", label: "Spanish" },
  { value: "french", label: "French" },
  { value: "german", label: "German" },
  { value: "italian", label: "Italian" },
  { value: "portuguese", label: "Portuguese" },
  { value: "russian", label: "Russian" },
  { value: "japanese", label: "Japanese" },
  { value: "chinese_mandarin", label: "Chinese (Mandarin)" },
  { value: "chinese_cantonese", label: "Chinese (Cantonese)" },
  { value: "arabic", label: "Arabic" },
  { value: "hindi", label: "Hindi" },
  { value: "bengali", label: "Bengali" },
  { value: "punjabi", label: "Punjabi" },
  { value: "tagalog", label: "Tagalog" },
  { value: "vietnamese", label: "Vietnamese" },
  { value: "korean", label: "Korean" },
  { value: "thai", label: "Thai" },
  { value: "hebrew", label: "Hebrew" },
  { value: "greek", label: "Greek" },
  { value: "polish", label: "Polish" },
  { value: "turkish", label: "Turkish" },
  { value: "dutch", label: "Dutch" },
  { value: "swedish", label: "Swedish" },
  { value: "norwegian", label: "Norwegian" },
  { value: "danish", label: "Danish" },
  { value: "finnish", label: "Finnish" },
] as const;

// Insurance plans commonly accepted by providers
export const INSURANCE_PLANS = [
  { value: "aetna", label: "Aetna" },
  { value: "anthem", label: "Anthem" },
  { value: "bluecross_blueshield", label: "BlueCross BlueShield" },
  { value: "cigna", label: "Cigna" },
  { value: "humana", label: "Humana" },
  { value: "medicare", label: "Medicare" },
  { value: "medicaid", label: "Medicaid" },
  { value: "tricare", label: "TRICARE" },
  { value: "united_healthcare", label: "UnitedHealthcare" },
  { value: "kaiser_permanente", label: "Kaiser Permanente" },
  { value: "molina_healthcare", label: "Molina Healthcare" },
  { value: "centene", label: "Centene" },
  { value: "carefirst", label: "CareFirst" },
  { value: "highmark", label: "Highmark" },
  { value: "horizon_bcbs", label: "Horizon Blue Cross Blue Shield" },
  { value: "independence_blue_cross", label: "Independence Blue Cross" },
  { value: "blue_shield_california", label: "Blue Shield of California" },
  { value: "oscar_health", label: "Oscar Health" },
  { value: "ambetter", label: "Ambetter" },
  { value: "wellcare", label: "WellCare" },
] as const;

// Common medical services offered by providers
export const MEDICAL_SERVICES = [
  { value: "primary_care", label: "Primary Care" },
  { value: "preventive_care", label: "Preventive Care" },
  { value: "urgent_care", label: "Urgent Care" },
  { value: "chronic_care_management", label: "Chronic Care Management" },
  { value: "telemedicine", label: "Telemedicine" },
  { value: "wellness_exams", label: "Wellness Exams" },
  { value: "vaccinations", label: "Vaccinations" },
  { value: "laboratory_services", label: "Laboratory Services" },
  { value: "diagnostic_imaging", label: "Diagnostic Imaging" },
  { value: "minor_procedures", label: "Minor Procedures" },
  { value: "physical_therapy", label: "Physical Therapy" },
  { value: "mental_health_counseling", label: "Mental Health Counseling" },
  { value: "nutrition_counseling", label: "Nutrition Counseling" },
  { value: "pain_management", label: "Pain Management" },
  { value: "womens_health", label: "Women's Health" },
  { value: "mens_health", label: "Men's Health" },
  { value: "pediatric_care", label: "Pediatric Care" },
  { value: "geriatric_care", label: "Geriatric Care" },
  { value: "sports_medicine", label: "Sports Medicine" },
  { value: "occupational_health", label: "Occupational Health" },
] as const;

// Type exports for use in TypeScript
export type GenderOption = (typeof GENDER_OPTIONS)[number]["value"];
export type PracticeTypeOption =
  (typeof PRACTICE_TYPE_OPTIONS)[number]["value"];
export type ExperienceLevelOption =
  (typeof EXPERIENCE_LEVEL_OPTIONS)[number]["value"];
export type USState = (typeof US_STATES)[number]["value"];
export type MedicalSpecialty = (typeof MEDICAL_SPECIALTIES)[number]["value"];
export type CommonLanguage = (typeof COMMON_LANGUAGES)[number]["value"];
export type InsurancePlan = (typeof INSURANCE_PLANS)[number]["value"];
export type MedicalService = (typeof MEDICAL_SERVICES)[number]["value"];
