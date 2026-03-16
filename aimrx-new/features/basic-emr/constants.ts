export const ITEMS_PER_PAGE = 10;

export const CONDITION_STATUSES = [
  { value: "active", label: "Active" },
  { value: "resolved", label: "Resolved" },
  { value: "inactive", label: "Inactive" },
] as const;

export const ENCOUNTER_STATUSES = [
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "in_progress", label: "In Progress" },
] as const;

export const ENCOUNTER_TYPES = [
  { value: "routine", label: "Routine" },
  { value: "follow_up", label: "Follow-up" },
  { value: "urgent", label: "Urgent" },
  { value: "consultation", label: "Consultation" },
] as const;

export const GENDER_OPTIONS = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Other", label: "Other" },
] as const;

export const MEDICATION_STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "discontinued", label: "Discontinued" },
] as const;

export const ORDER_TYPES = [
  { value: "lab", label: "Laboratory" },
  { value: "imaging", label: "Imaging" },
  { value: "medication", label: "Medication" },
  { value: "referral", label: "Referral" },
] as const;

export const SEVERITY_LEVELS = [
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
] as const;

export const US_STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

export const TIME_SLOTS = [
  "8:00 AM",
  "8:30 AM",
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
  "4:30 PM",
  "5:00 PM",
  "5:30 PM",
];

export const INTAKE_DATA = {
  chiefComplaint:
    'Patient reports persistent headache for the past 3 days, with pain radiating from the temples to the back of the head. Pain is described as "throbbing" and rates it as 6/10 on pain scale.',
  historyOfPresentIllness:
    "Headache started gradually after a particularly stressful work meeting. Patient has tried over-the-counter painkillers (acetaminophen) with minimal relief. No history of similar headaches in the past. No associated symptoms like nausea, vomiting, or visual disturbances.",
  preVisitQuestions: [
    {
      question: "Have you been experiencing any fever?",
      answer: "No",
    },
    {
      question: "Are you having trouble with vision or sensitivity to light?",
      answer: "Mild sensitivity to bright light, but no vision changes",
    },
    {
      question: "Have you experienced recent trauma to the head?",
      answer: "No",
    },
    {
      question: "Are you taking any new medications?",
      answer: "Started taking a multivitamin 2 weeks ago",
    },
    {
      question: "Have there been any changes in your sleep pattern?",
      answer: "Yes, having difficulty falling asleep due to work stress",
    },
  ],
  recentMedicalHistory: [
    "Annual physical exam (3 months ago) - All results normal",
    "Dental cleaning (1 month ago)",
    "No hospitalizations in past 5 years",
    "No recent surgeries",
  ],
  currentMedications: [
    "Multivitamin (daily, started 2 weeks ago)",
    "No prescription medications",
  ],
};
