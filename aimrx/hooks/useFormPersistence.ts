import { useEffect, useRef } from "react";
import { UseFormWatch, UseFormSetValue, FieldValues, Path } from "react-hook-form";

interface UseFormPersistenceOptions<T extends FieldValues> {
  storageKey: string;
  watch: UseFormWatch<T>;
  setValue: UseFormSetValue<T>;
  excludeFields?: (keyof T)[];
  disabled?: boolean;
}

/**
 * Custom hook to persist form data to localStorage
 * Automatically saves form data as user types and restores it on mount
 *
 * @param storageKey - Unique key for localStorage
 * @param watch - React Hook Form watch function
 * @param setValue - React Hook Form setValue function
 * @param excludeFields - Fields to exclude from persistence (e.g., passwords)
 * @param disabled - Disable persistence (useful when editing existing data)
 */
export function useFormPersistence<T extends FieldValues>({
  storageKey,
  watch,
  setValue,
  excludeFields = [],
  disabled = false,
}: UseFormPersistenceOptions<T>) {
  const isLoadingRef = useRef(false);
  const hasLoadedRef = useRef(false);

  // Load saved data on mount (only once)
  useEffect(() => {
    if (disabled || hasLoadedRef.current) return;

    isLoadingRef.current = true;
    hasLoadedRef.current = true;

    try {
      const savedData = localStorage.getItem(storageKey);
      if (savedData) {
        const parsedData = JSON.parse(savedData) as T;

        // Restore all fields except excluded ones
        Object.keys(parsedData).forEach((key) => {
          if (!excludeFields.includes(key as keyof T)) {
            setValue(key as Path<T>, parsedData[key as keyof T], {
              shouldValidate: false
            });
          }
        });
      }
    } catch (error) {
      console.error("Error loading form data from localStorage:", error);
    }

    // Reset loading flag after a short delay
    setTimeout(() => {
      isLoadingRef.current = false;
    }, 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, disabled]);

  // Save data whenever form changes
  useEffect(() => {
    if (disabled) return;

    const subscription = watch((formData) => {
      // Skip saving while loading to prevent loop
      if (isLoadingRef.current) return;

      try {
        // Filter out excluded fields
        const dataToSave = { ...formData };
        excludeFields.forEach((field) => {
          delete dataToSave[field as string];
        });

        localStorage.setItem(storageKey, JSON.stringify(dataToSave));
      } catch (error) {
        console.error("Error saving form data to localStorage:", error);
      }
    });

    return () => subscription.unsubscribe();
  }, [watch, storageKey, disabled, excludeFields]);

  // Clear saved data
  const clearPersistedData = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error("Error clearing persisted form data:", error);
    }
  };

  return { clearPersistedData };
}
