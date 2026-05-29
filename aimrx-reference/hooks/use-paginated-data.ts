export const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 12,
  DEBOUNCE_MS: 300,
  MAX_PAGE_SIZE: 100,
} as const;

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  page: number;
  itemsPerPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginationFilters {
  page: number;
  itemsPerPage: number;
  searchTerm?: string;
}

export function calculatePaginationMeta(
  totalCount: number,
  page: number,
  itemsPerPage: number,
) {
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return {
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    startItem: (page - 1) * itemsPerPage + 1,
    endItem: Math.min(page * itemsPerPage, totalCount),
  };
}
