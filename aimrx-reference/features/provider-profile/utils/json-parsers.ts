/**
 * Safely parse a value that might be a JSON string or already an array
 * @param value - The value to parse
 * @returns An array, or empty array if parsing fails
 */
export const safeParse = (value: unknown): unknown[] => {
  if (!value) return [];
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
};

/**
 * Safely parse a value that might be a JSON string or already an array with type assertion
 * @param value - The value to parse
 * @returns A typed array, or empty array if parsing fails
 */
export const safeParseTyped = <T>(value: unknown): T[] => {
  if (!value) return [];
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? (value as T[]) : [];
};

/**
 * Safely parse a value that might be a JSON string or already an object
 * @param value - The value to parse
 * @returns An object, or empty object if parsing fails
 */
export const safeParseObject = (value: unknown): Record<string, unknown> => {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
};

/**
 * Safely parse a value that might be a JSON string or already an object with type assertion
 * @param value - The value to parse
 * @returns A typed object, or empty object if parsing fails
 */
export const safeParseObjectTyped = <T extends Record<string, unknown>>(
  value: unknown,
): T => {
  if (!value) return {} as T;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {} as T;
    }
  }
  return typeof value === "object" && value !== null ? (value as T) : ({} as T);
};
