export const DEFAULT_NEW_PROCEDURE = {
  code: "99203",
  description: "New Patient Office Visit Level 3",
  modifiers: "",
} as const;

export const MESSAGES = {
  LOADING: "Loading billing information...",
  ERROR_TITLE: "Error loading billing information",
  RETRY: "Retry",
  ADD_PROCEDURE: "Add Procedure",
  CANNOT_REMOVE_PRIMARY:
    "Cannot remove primary status from the only primary diagnosis",
  CANNOT_REMOVE_LAST_PRIMARY:
    "Cannot remove the last primary diagnosis. Please make another diagnosis primary first.",
} as const;
