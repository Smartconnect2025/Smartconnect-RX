import React, { useState, useCallback } from "react";
import { useDebouncedCallback } from "use-debounce";

interface UseFilterStateOptions<T = string> {
  initialSearchTerm?: string;
  initialSelectedTypes?: T[];
  initialActiveTags?: string[];
  initialPage?: number;
  searchDebounceMs?: number;
  onFiltersChange?: (filters: FilterState<T>) => void;
}

export interface FilterState<T = string> {
  searchTerm: string;
  selectedTypes: T[];
  activeTags: string[];
  page: number;
}

interface UseFilterStateReturn<T = string> {
  searchInput: string;
  searchTerm: string;
  selectedTypes: T[];
  activeTags: string[];
  currentPage: number;

  setSearchInput: (value: string) => void;
  setSelectedTypes: React.Dispatch<React.SetStateAction<T[]>>;
  setActiveTags: React.Dispatch<React.SetStateAction<string[]>>;
  setCurrentPage: (page: number) => void;

  toggleType: (type: T) => void;
  toggleTag: (tag: string) => void;
  clearAllFilters: () => void;
  resetPage: () => void;

  hasActiveFilters: boolean;
  activeFiltersCount: number;
  filterState: FilterState<T>;
}

export function useFilterState<T = string>({
  initialSearchTerm = "",
  initialSelectedTypes = [],
  initialActiveTags = [],
  initialPage = 1,
  searchDebounceMs = 300,
  onFiltersChange,
}: UseFilterStateOptions<T> = {}): UseFilterStateReturn<T> {
  const [searchInput, setSearchInput] = useState(initialSearchTerm);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [selectedTypes, setSelectedTypes] = useState<T[]>(initialSelectedTypes);
  const [activeTags, setActiveTags] = useState<string[]>(initialActiveTags);
  const [currentPage, setCurrentPage] = useState(initialPage);

  const debouncedSetSearchTerm = useDebouncedCallback((value: string) => {
    setSearchTerm(value);
    setCurrentPage(initialPage);
  }, searchDebounceMs);

  const handleSearchInput = useCallback(
    (value: string) => {
      setSearchInput(value);
      debouncedSetSearchTerm(value);
    },
    [debouncedSetSearchTerm],
  );

  const handleSetSelectedTypes: React.Dispatch<React.SetStateAction<T[]>> =
    useCallback(
      (value) => {
        setSelectedTypes(value);
        setCurrentPage(initialPage);
      },
      [initialPage],
    );

  const handleSetActiveTags: React.Dispatch<React.SetStateAction<string[]>> =
    useCallback(
      (value) => {
        setActiveTags(value);
        setCurrentPage(initialPage);
      },
      [initialPage],
    );

  const toggleType = useCallback(
    (type: T) => {
      setSelectedTypes((prev) => {
        const isSelected = prev.includes(type);
        const newTypes = isSelected
          ? prev.filter((t) => t !== type)
          : [...prev, type];

        setCurrentPage(initialPage);
        return newTypes;
      });
    },
    [initialPage],
  );

  const toggleTag = useCallback(
    (tag: string) => {
      setActiveTags((prev) => {
        const isSelected = prev.includes(tag);
        const newTags = isSelected
          ? prev.filter((t) => t !== tag)
          : [...prev, tag];

        setCurrentPage(initialPage);
        return newTags;
      });
    },
    [initialPage],
  );

  const clearAllFilters = useCallback(() => {
    setSearchInput(initialSearchTerm);
    setSearchTerm(initialSearchTerm);
    setSelectedTypes(initialSelectedTypes);
    setActiveTags(initialActiveTags);
    setCurrentPage(initialPage);
  }, [initialSearchTerm, initialSelectedTypes, initialActiveTags, initialPage]);

  const resetPage = useCallback(() => {
    setCurrentPage(initialPage);
  }, [initialPage]);

  const hasActiveFilters =
    searchTerm !== initialSearchTerm ||
    selectedTypes.length > 0 ||
    activeTags.length > 0;

  const activeFiltersCount = selectedTypes.length + activeTags.length;

  const filterState: FilterState<T> = React.useMemo(
    () => ({
      searchTerm,
      selectedTypes,
      activeTags,
      page: currentPage,
    }),
    [searchTerm, selectedTypes, activeTags, currentPage],
  );

  React.useEffect(() => {
    if (onFiltersChange) {
      onFiltersChange(filterState);
    }
  }, [filterState, onFiltersChange]);

  return {
    searchInput,
    searchTerm,
    selectedTypes,
    activeTags,
    currentPage,

    setSearchInput: handleSearchInput,
    setSelectedTypes: handleSetSelectedTypes,
    setActiveTags: handleSetActiveTags,
    setCurrentPage,

    toggleType,
    toggleTag,
    clearAllFilters,
    resetPage,

    hasActiveFilters,
    activeFiltersCount,
    filterState,
  };
}
